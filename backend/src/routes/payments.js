/**
 * Payment routes - handles creating payment intents and confirming payments
 * Works in mock mode without Stripe account, switches to real mode when keys are configured
 */

const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createPaymentIntent, getPaymentIntent, isConfigured } = require('../services/stripeService');

const router = express.Router();

/**
 * POST /api/payments/create-payment-intent
 * Create a payment intent for event registration
 * Called BEFORE creating the registration (payment first, registration second)
 */
router.post('/create-payment-intent', requireAuth, async (req, res) => {
  const { eventId, products, teamId, comments } = req.body;

  try {
    // Validate event exists
    const event = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (!event.rows[0]) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Calculate total price (in cents)
    let totalCents = 0;

    for (const { product_id, quantity, field_values } of products) {
      const product = await pool.query(
        'SELECT price, fields FROM event_products WHERE id = $1 AND event_id = $2',
        [product_id, eventId]
      );

      if (!product.rows[0]) {
        return res.status(400).json({ error: `Product ${product_id} not found` });
      }

      let productPrice = parseFloat(product.rows[0].price);
      const fields = product.rows[0].fields || [];

      // Check if any dropdown option has a custom price override
      if (field_values) {
        for (const field of fields) {
          if (field.type === 'select') {
            const selectedValue = field_values[field.id];
            if (selectedValue) {
              const option = field.options.find(opt => {
                const optVal = typeof opt === 'string' ? opt : opt.value;
                return optVal === selectedValue;
              });

              if (option && typeof option === 'object' && option.price !== null && option.price !== undefined) {
                productPrice = parseFloat(option.price);
                break;
              }
            }
          }
        }
      }

      totalCents += Math.round(productPrice * quantity * 100);
    }

    if (totalCents < 1) {
      return res.status(400).json({ error: 'Total amount must be greater than €0.01' });
    }

    // Create payment intent (mock or real)
    const paymentIntent = await createPaymentIntent(null, totalCents, req.user.email);

    // Store pending registration in session (temporary, until payment confirmed)
    if (!req.session) req.session = {};
    req.session.pendingRegistration = {
      eventId,
      userId: req.user.id,
      teamId,
      products,
      comments,
      paymentIntentId: paymentIntent.id,
      totalCents,
      createdAt: Date.now()
    };

    console.log(`[PAYMENT] Created intent ${paymentIntent.id} for €${(totalCents / 100).toFixed(2)}`);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalCents,
      amountFormatted: `€${(totalCents / 100).toFixed(2)}`,
      mockMode: !isConfigured()
    });
  } catch (err) {
    console.error('[PAYMENT ERROR] Failed to create payment intent:', err.message);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

/**
 * POST /api/payments/confirm-payment
 * Confirm payment with Stripe and create the registration
 * Called AFTER user completes payment in the UI
 */
router.post('/confirm-payment', requireAuth, async (req, res) => {
  const { paymentIntentId } = req.body;

  if (!paymentIntentId) {
    return res.status(400).json({ error: 'paymentIntentId is required' });
  }

  const client = await pool.connect();

  try {
    // Step 1: Verify payment intent status with Stripe
    const paymentIntent = await getPaymentIntent(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: 'Payment not successful',
        status: paymentIntent.status
      });
    }

    // Step 2: Retrieve pending registration data from session
    const pendingReg = req.session?.pendingRegistration;

    if (!pendingReg) {
      return res.status(400).json({ error: 'No pending registration found. Please start over.' });
    }

    if (pendingReg.paymentIntentId !== paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent mismatch' });
    }

    // Check if session expired (older than 30 minutes)
    if (Date.now() - pendingReg.createdAt > 30 * 60 * 1000) {
      return res.status(400).json({ error: 'Session expired. Please start registration again.' });
    }

    // Step 3: Begin transaction to create registration and record payment
    await client.query('BEGIN');

    // Create registration
    const regResult = await client.query(
      `INSERT INTO registrations (user_id, event_id, team_id, comments)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        req.user.id,
        pendingReg.eventId,
        pendingReg.teamId || null,
        pendingReg.comments || null
      ]
    );

    const registrationId = regResult.rows[0].id;

    // Insert products for this registration
    for (const { product_id, quantity, field_values } of pendingReg.products) {
      await client.query(
        `INSERT INTO registration_products (registration_id, product_id, quantity, field_values)
         VALUES ($1, $2, $3, $4)`,
        [registrationId, product_id, quantity, JSON.stringify(field_values || {})]
      );
    }

    // Record payment intent
    await client.query(
      `INSERT INTO payment_intents (stripe_payment_intent_id, registration_id, amount_cents, status)
       VALUES ($1, $2, $3, $4)`,
      [paymentIntentId, registrationId, pendingReg.totalCents, paymentIntent.status]
    );

    // Create invoice
    const invoiceNumber = `INV-${registrationId}-${Date.now()}`;
    const invoiceResult = await client.query(
      `INSERT INTO invoices (registration_id, amount_cents, invoice_number, paid_at)
       VALUES ($1, $2, $3, NOW()) RETURNING id`,
      [registrationId, pendingReg.totalCents, invoiceNumber]
    );

    await client.query('COMMIT');

    // Clear session
    if (req.session) {
      delete req.session.pendingRegistration;
    }

    console.log(`[PAYMENT] Confirmed payment ${paymentIntentId}, created registration ${registrationId}`);

    res.json({
      success: true,
      message: 'Registration completed successfully',
      registrationId,
      invoiceNumber,
      amount: pendingReg.totalCents,
      amountFormatted: `€${(pendingReg.totalCents / 100).toFixed(2)}`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PAYMENT ERROR] Failed to confirm payment:', err.message);
    res.status(500).json({ error: 'Failed to complete registration' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/payments/status/:paymentIntentId
 * Check the status of a payment (useful for polling)
 */
router.get('/status/:paymentIntentId', requireAuth, async (req, res) => {
  try {
    const paymentIntent = await getPaymentIntent(req.params.paymentIntentId);

    res.json({
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      amountFormatted: `€${(paymentIntent.amount / 100).toFixed(2)}`
    });
  } catch (err) {
    console.error('[PAYMENT ERROR] Failed to check payment status:', err.message);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

module.exports = router;
