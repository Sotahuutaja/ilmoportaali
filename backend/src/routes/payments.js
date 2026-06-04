/**
 * Payment routes - handles creating payment intents and confirming payments
 * Works in mock mode without Stripe account, switches to real mode when keys are configured
 */

const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createPaymentIntent, getPaymentIntent, isConfigured } = require('../services/stripeService');
const { sendRegistrationConfirmation } = require('../services/emailService');

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

    // Don't store in session - pass back to frontend instead

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
 * Confirm payment with Stripe and create registrations (captain + guests)
 * Called AFTER user completes payment in the UI
 */
router.post('/confirm-payment', requireAuth, async (req, res) => {
  const { paymentIntentId, eventId, registrations } = req.body;
  
  console.log('[PAYMENT] Received confirm-payment request');
  console.log('[PAYMENT] paymentIntentId:', paymentIntentId);
  console.log('[PAYMENT] eventId:', eventId);
  console.log('[PAYMENT] registrations structure:', JSON.stringify(registrations, null, 2));

  if (!paymentIntentId) {
    return res.status(400).json({ error: 'paymentIntentId is required' });
  }

  if (!eventId || !registrations) {
    return res.status(400).json({ error: 'eventId and registrations are required' });
  }

  const captain = registrations.captain;
  const guests = registrations.guests || [];

  if (!captain || !captain.products || !Array.isArray(captain.products)) {
    return res.status(400).json({ error: 'Captain registration with products is required' });
  }

  const client = await pool.connect();

  try {
    // Step 1: Verify payment intent status with Stripe
    console.log('[PAYMENT] Verifying payment intent:', paymentIntentId);
    const paymentIntent = await getPaymentIntent(paymentIntentId);
    console.log('[PAYMENT] Payment intent status:', paymentIntent.status);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        error: 'Payment not successful',
        status: paymentIntent.status
      });
    }

    // Step 2: Begin transaction to create registrations and record payment
    await client.query('BEGIN');

    const registrationIds = [];
    let totalCents = 0;

    // Helper function to create a single registration
    const createRegistration = async (isGuest, guestData = null) => {
      let regResult;

      if (isGuest) {
        // Create guest registration
        regResult = await client.query(
          `INSERT INTO registrations (user_id, event_id, team_id, comments, is_guest, guest_first_name, guest_last_name, year_of_birth, gender)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [
            null,
            eventId,
            guestData.team_id || null,
            guestData.comments || null,
            true,
            guestData.guest_first_name,
            guestData.guest_last_name,
            guestData.year_of_birth || null,
            guestData.gender || null
          ]
        );
      } else {
        // Create captain registration
        regResult = await client.query(
          `INSERT INTO registrations (user_id, event_id, team_id, comments)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [
            req.user.id,
            eventId,
            captain.teamId || null,
            captain.comments || null
          ]
        );
      }

      const regId = regResult.rows[0].id;
      const productsToAdd = isGuest ? guestData.products : captain.products;

      // Add products to registration
      for (const { product_id, quantity, field_values } of productsToAdd) {
        const product = await client.query(
          'SELECT price FROM event_products WHERE id = $1',
          [product_id]
        );

        if (product.rows[0]) {
          totalCents += Math.round(parseFloat(product.rows[0].price) * quantity * 100);
        }

        // Insert product for this registration
        await client.query(
          `INSERT INTO registration_products (registration_id, product_id, quantity, field_values)
           VALUES ($1, $2, $3, $4)`,
          [regId, product_id, quantity, JSON.stringify(field_values || {})]
        );
      }

      return regId;
    };

    // Create captain registration
    console.log('[PAYMENT] Creating captain registration');
    const captainRegId = await createRegistration(false);
    console.log('[PAYMENT] Captain registration created:', captainRegId);
    registrationIds.push(captainRegId);

    // Create guest registrations
    console.log('[PAYMENT] Creating guest registrations, count:', guests.length);
    for (let i = 0; i < guests.length; i++) {
      const guest = guests[i];
      console.log('[PAYMENT] Creating guest', i + 1, ':', guest.guest_first_name);
      const guestRegId = await createRegistration(true, guest);
      console.log('[PAYMENT] Guest registration created:', guestRegId);
      registrationIds.push(guestRegId);
    }

    // Record payment intent (link to captain registration)
    await client.query(
      `INSERT INTO payment_intents (stripe_payment_intent_id, registration_id, amount_cents, status)
       VALUES ($1, $2, $3, $4)`,
      [paymentIntentId, captainRegId, totalCents, paymentIntent.status]
    );

    // Create invoice
    const invoiceNumber = `INV-${captainRegId}-${Date.now()}`;
    await client.query(
      `INSERT INTO invoices (registration_id, amount_cents, invoice_number, paid_at)
       VALUES ($1, $2, $3, NOW())`,
      [captainRegId, totalCents, invoiceNumber]
    );

    await client.query('COMMIT');

    console.log(`[PAYMENT] Confirmed payment ${paymentIntentId}, created ${registrationIds.length} registration(s): ${registrationIds.join(', ')}`);

    // Send confirmation emails (async, don't wait for it)
    try {
      const eventResult = await pool.query('SELECT title, starts_at FROM events WHERE id = $1', [eventId]);
      const event = eventResult.rows[0];

      if (event) {
        // Fetch product details for the captain
        const captainProductsResult = await pool.query(
          `SELECT ep.name, ep.price, rp.quantity
           FROM registration_products rp
           JOIN event_products ep ON rp.product_id = ep.id
           WHERE rp.registration_id = $1
           ORDER BY ep.name`,
          [captainRegId]
        );

        const captainProducts = captainProductsResult.rows.map(p => ({
          name: p.name,
          price: parseFloat(p.price),
          quantity: p.quantity
        }));

        // Send email to captain with all registrations summary
        sendRegistrationConfirmation(req.user.email, {
          userName: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email,
          eventName: event.title,
          registrationId: captainRegId,
          invoiceNumber,
          amountFormatted: `€${(totalCents / 100).toFixed(2)}`,
          eventDate: new Date(event.starts_at).toLocaleDateString('fi-FI', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          guestCount: guests.length
        }, captainProducts).catch(err => console.error('Email send error:', err));
      }
    } catch (err) {
      console.error('[PAYMENT] Failed to send confirmation email:', err.message);
      // Don't block the response - email is not critical
    }

    res.json({
      success: true,
      message: `Registration completed successfully (${registrationIds.length} registration(s))`,
      registrationId: captainRegId,
      registrationIds,
      invoiceNumber,
      amount: totalCents,
      amountFormatted: `€${(totalCents / 100).toFixed(2)}`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PAYMENT ERROR] Failed to confirm payment:', err.message);
    console.error('[PAYMENT ERROR] Full error:', err);
    res.status(500).json({ error: 'Failed to complete registration', detail: err.message });
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
