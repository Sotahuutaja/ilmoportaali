/**
 * Webhook handlers for external services
 * Currently handles Stripe payment webhooks
 */

const express = require('express');
const pool = require('../db');
const { constructWebhookEvent } = require('../services/stripeService');

const router = express.Router();

/**
 * POST /api/webhooks/stripe
 * Webhook endpoint for Stripe payment events
 * Stripe sends events when payments succeed, fail, or require action
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    // Verify and parse webhook event
    const event = constructWebhookEvent(req.body, sig);

    console.log(`[WEBHOOK] Received Stripe event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'payment_intent.canceled':
        await handlePaymentCanceled(event.data.object);
        break;

      // Add more event handlers as needed
      default:
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
    }

    // Always return 200 to acknowledge receipt
    res.json({ received: true });
  } catch (err) {
    console.error('[WEBHOOK ERROR] Failed to process webhook:', err.message);
    // Return 400 so Stripe retries the webhook
    res.status(400).json({ error: 'Webhook error' });
  }
});

/**
 * Handle payment_intent.succeeded event
 * Update payment status in database
 */
async function handlePaymentSucceeded(paymentIntent) {
  try {
    const result = await pool.query(
      `UPDATE payment_intents
       SET status = $1, updated_at = NOW()
       WHERE stripe_payment_intent_id = $2
       RETURNING registration_id`,
      ['succeeded', paymentIntent.id]
    );

    if (result.rows.length > 0) {
      console.log(`[WEBHOOK] Payment ${paymentIntent.id} succeeded, registration ${result.rows[0].registration_id}`);
    } else {
      console.warn(`[WEBHOOK] Payment ${paymentIntent.id} succeeded but not found in database`);
    }
  } catch (err) {
    console.error('[WEBHOOK ERROR] Failed to handle payment succeeded:', err.message);
    throw err;
  }
}

/**
 * Handle payment_intent.payment_failed event
 * Mark payment as failed, allow retry
 */
async function handlePaymentFailed(paymentIntent) {
  try {
    await pool.query(
      `UPDATE payment_intents
       SET status = $1, updated_at = NOW()
       WHERE stripe_payment_intent_id = $2`,
      ['failed', paymentIntent.id]
    );

    console.log(`[WEBHOOK] Payment ${paymentIntent.id} failed`);
  } catch (err) {
    console.error('[WEBHOOK ERROR] Failed to handle payment failed:', err.message);
    throw err;
  }
}

/**
 * Handle payment_intent.canceled event
 * Mark payment as canceled
 */
async function handlePaymentCanceled(paymentIntent) {
  try {
    await pool.query(
      `UPDATE payment_intents
       SET status = $1, updated_at = NOW()
       WHERE stripe_payment_intent_id = $2`,
      ['canceled', paymentIntent.id]
    );

    console.log(`[WEBHOOK] Payment ${paymentIntent.id} canceled`);
  } catch (err) {
    console.error('[WEBHOOK ERROR] Failed to handle payment canceled:', err.message);
    throw err;
  }
}

module.exports = router;
