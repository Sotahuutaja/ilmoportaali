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
      // Validate quantity is a positive integer
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ error: 'Quantity must be a positive integer' });
      }

      // Validate field_values is an object if provided
      if (field_values && typeof field_values !== 'object') {
        return res.status(400).json({ error: 'field_values must be an object' });
      }

      const product = await pool.query(
        'SELECT price, fields, quantity FROM event_products WHERE id = $1 AND event_id = $2',
        [product_id, eventId]
      );

      if (!product.rows[0]) {
        return res.status(400).json({ error: `Product ${product_id} not found` });
      }

      // Validate that select fields have values selected
      const fields = product.rows[0].fields || [];
      for (const field of fields) {
        if (field.type === 'select') {
          const selectedValue = field_values?.[field.id];
          if (!selectedValue) {
            return res.status(400).json({
              error: `${field.label} is required for ${product.rows[0].name}`
            });
          }
        }
      }

      // Validate available quantity for products with stock limits
      if (product.rows[0].quantity !== null) {
        const used = await pool.query(
          'SELECT COALESCE(SUM(quantity), 0) as used FROM registration_products WHERE product_id = $1',
          [product_id]
        );
        const remaining = product.rows[0].quantity - parseInt(used.rows[0].used);
        if (remaining < quantity) {
          return res.status(409).json({
            error: `Product has insufficient stock`,
            requested: quantity,
            remaining: remaining
          });
        }
      }

      let productPrice = parseFloat(product.rows[0].price);

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
  const { paymentIntentId, eventId, registrations, expectedAmount } = req.body;

  console.log('[PAYMENT] Received confirm-payment request');
  console.log('[PAYMENT] paymentIntentId:', paymentIntentId);
  console.log('[PAYMENT] eventId:', eventId);
  console.log('[PAYMENT] expectedAmount:', expectedAmount);
  console.log('[PAYMENT] registrations structure:', JSON.stringify(registrations, null, 2));

  if (!paymentIntentId) {
    return res.status(400).json({ error: 'paymentIntentId is required' });
  }

  // Check if this is an additional payment (payment for existing registration)
  const isAdditionalPayment = registrations?.isAdditionalPayment === true;

  if (!isAdditionalPayment && (!eventId || !registrations)) {
    return res.status(400).json({ error: 'eventId and registrations are required' });
  }

  // For additional payments, we just need to update payment status
  // For normal payments, we need captain and guests info
  let captain, guests;
  if (!isAdditionalPayment) {
    captain = registrations.captain;
    guests = registrations.guests || [];

    if (!captain || !Array.isArray(captain.products)) {
      return res.status(400).json({ error: 'Captain registration is required' });
    }

    // Ensure either captain or guests have products
    const captainHasProducts = captain.products.length > 0;
    const guestsHaveProducts = guests.some(g => g.products && g.products.length > 0);

    if (!captainHasProducts && !guestsHaveProducts) {
      return res.status(400).json({ error: 'At least one product must be registered' });
    }
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

    // Verify that the authenticated user owns this payment intent
    if (paymentIntent.metadata?.email !== req.user.email) {
      console.error('[PAYMENT ERROR] Payment intent email mismatch:', paymentIntent.metadata?.email, '!==', req.user.email);
      return res.status(403).json({ error: 'Payment intent does not belong to you' });
    }

    // Verify the payment amount matches what was expected (price reconciliation)
    if (expectedAmount && paymentIntent.amount !== expectedAmount) {
      console.error('[PAYMENT ERROR] Payment amount mismatch:', paymentIntent.amount, '!==', expectedAmount);
      return res.status(400).json({
        error: 'Payment amount mismatch. Please try again.',
        expected: expectedAmount,
        actual: paymentIntent.amount
      });
    }

    // Step 2: Handle additional payment (update existing registration)
    if (isAdditionalPayment) {
      console.log('[PAYMENT] Processing additional payment for intent:', paymentIntentId);

      // Find which registration this additional payment belongs to
      const existingPayment = await client.query(
        'SELECT registration_id, amount_cents FROM payment_intents WHERE stripe_payment_intent_id = $1',
        [paymentIntentId]
      );

      if (!existingPayment.rows[0]) {
        return res.status(400).json({ error: 'Payment intent not found' });
      }

      const registrationId = existingPayment.rows[0].registration_id;

      await client.query('BEGIN');

      try {
        // Update payment status to paid
        await client.query(
          'UPDATE registrations SET payment_status = $1 WHERE id = $2',
          ['paid', registrationId]
        );

        // Record the payment in payment_intents (mark as confirmed)
        await client.query(
          'UPDATE payment_intents SET status = $1 WHERE stripe_payment_intent_id = $2',
          ['succeeded', paymentIntentId]
        );

        await client.query('COMMIT');

        console.log('[PAYMENT] Additional payment confirmed for registration', registrationId);

        res.json({
          success: true,
          message: 'Additional payment processed successfully',
          registrationId: registrationId,
          amount: existingPayment.rows[0].amount_cents,
          amountFormatted: `€${(existingPayment.rows[0].amount_cents / 100).toFixed(2)}`
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }

      return;
    }

    // Step 3: Check if normal payment has already been processed (idempotency)
    const existingPayment = await client.query(
      'SELECT id FROM payment_intents WHERE stripe_payment_intent_id = $1',
      [paymentIntentId]
    );
    if (existingPayment.rows[0]) {
      return res.status(409).json({
        error: 'This payment has already been processed',
        registrationId: existingPayment.rows[0].id
      });
    }

    // Step 4: Begin transaction to create registrations and record payment
    await client.query('BEGIN');

    const registrationIds = [];
    let totalCents = 0;

    // Check if captain is already registered for this event
    // Use FOR UPDATE to lock the row and prevent race conditions with concurrent payments
    const existingCaptainReg = await client.query(
      'SELECT id FROM registrations WHERE user_id = $1 AND event_id = $2 FOR UPDATE',
      [req.user.id, eventId]
    );
    const existingCaptainRegId = existingCaptainReg.rows[0]?.id;

    // Prevent non-captain users from re-registering
    // But allow captains to add guests to their existing registration
    if (existingCaptainRegId && captain.products.length > 0 && !registrations.guests) {
      // User already registered and trying to re-register themselves (no guests)
      return res.status(409).json({
        error: 'You are already registered for this event. To modify your registration, contact event organizers.'
      });
    }

    if (existingCaptainRegId && captain.products.length === 0 && (!registrations.guests || registrations.guests.length === 0)) {
      // Trying to create empty registration - error
      return res.status(400).json({
        error: 'No products to register'
      });
    }

    // Helper function to create a single registration
    const createRegistration = async (isGuest, guestData = null) => {
      let regResult;

      if (isGuest) {
        // Create guest registration
        regResult = await client.query(
          `INSERT INTO registrations (user_id, event_id, team_id, comments, is_guest, guest_first_name, guest_last_name, year_of_birth, gender, registered_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [
            null,
            eventId,
            guestData.team_id || null,
            guestData.comments || null,
            true,
            guestData.guest_first_name,
            guestData.guest_last_name,
            guestData.year_of_birth || null,
            guestData.gender || null,
            req.user.id
          ]
        );
      } else {
        // Create or update captain registration
        if (existingCaptainRegId) {
          // Captain already registered, update existing registration
          regResult = await client.query(
            `UPDATE registrations SET team_id = $1, comments = $2 WHERE id = $3 RETURNING id`,
            [
              captain.teamId || null,
              captain.comments || null,
              existingCaptainRegId
            ]
          );
          regResult.rows[0].id = existingCaptainRegId;
        } else {
          // Create new captain registration
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
      }

      const regId = regResult.rows[0].id;
      const productsToAdd = isGuest ? guestData.products : captain.products;

      // Add products to registration
      for (const { product_id, quantity, field_values } of productsToAdd) {
        // Validate quantity is a positive integer
        if (!Number.isInteger(quantity) || quantity < 1) {
          throw new Error('Quantity must be a positive integer');
        }

        // Validate field_values is an object if provided
        if (field_values && typeof field_values !== 'object') {
          throw new Error('field_values must be an object');
        }

        // Validate select fields have values before querying product
        const productInfo = await client.query(
          'SELECT price, fields, quantity FROM event_products WHERE id = $1',
          [product_id]
        );

        if (!productInfo.rows[0]) {
          throw new Error(`Product ${product_id} not found`);
        }

        // Validate that select fields have values selected
        const fields = productInfo.rows[0].fields || [];
        for (const field of fields) {
          if (field.type === 'select') {
            const selectedValue = field_values?.[field.id];
            if (!selectedValue) {
              throw new Error(`${field.label} is required`);
            }
          }
        }

        const product = productInfo;

        // Validate available quantity for products with stock limits
        if (product.rows[0].quantity !== null) {
          const used = await client.query(
            'SELECT COALESCE(SUM(quantity), 0) as used FROM registration_products WHERE product_id = $1',
            [product_id]
          );
          const remaining = product.rows[0].quantity - parseInt(used.rows[0].used);
          if (remaining < quantity) {
            throw new Error(`Product has insufficient stock (${remaining} remaining, ${quantity} requested)`);
          }
        }

        if (product.rows[0]) {
          // Calculate price with field option overrides
          let productPrice = parseFloat(product.rows[0].price);
          const fields = product.rows[0].fields || [];

          if (field_values && fields.length > 0) {
            for (const field of fields) {
              if (field.type === 'select') {
                const selectedValue = field_values[field.id];
                if (selectedValue && field.options) {
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

        // Insert product for this registration
        await client.query(
          `INSERT INTO registration_products (registration_id, product_id, quantity, field_values)
           VALUES ($1, $2, $3, $4)`,
          [regId, product_id, quantity, JSON.stringify(field_values || {})]
        );
        console.log(`[PAYMENT] Inserted registration_product: reg=${regId}, product=${product_id}, qty=${quantity}`);
      }

      return regId;
    };

    // Create or update captain registration
    console.log('[PAYMENT] Creating/updating captain registration');
    const captainRegId = await createRegistration(false);
    console.log('[PAYMENT] Captain registration ID:', captainRegId);
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

    // Update payment status to 'paid' for captain and all guest registrations
    await client.query(
      'UPDATE registrations SET payment_status = $1 WHERE id = ANY($2)',
      ['paid', registrationIds]
    );

    await client.query('COMMIT');

    console.log(`[PAYMENT] Confirmed payment ${paymentIntentId}, created ${registrationIds.length} registration(s): ${registrationIds.join(', ')}`);

    // Queue confirmation email for sending (async retry pattern)
    // Insert into email_queue so it can be retried if sending fails
    try {
      await pool.query(
        `INSERT INTO email_queue (registration_id, email_type, recipient_email, status)
         VALUES ($1, $2, $3, $4)`,
        [captainRegId, 'registration_confirmation', req.user.email, 'pending']
      );
      console.log('[PAYMENT] Queued confirmation email for registration', captainRegId);
    } catch (err) {
      console.error('[PAYMENT] Failed to queue confirmation email:', err.message);
      // Don't block the response - email will be retried
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
