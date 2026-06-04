/**
 * Stripe payment service
 * Handles PaymentIntent creation, confirmation, and status checks
 * Uses mock implementation if STRIPE_SECRET_KEY is not configured
 */

const stripeKey = process.env.STRIPE_SECRET_KEY;
let stripe = null;

// Only initialize Stripe if key is configured
if (stripeKey) {
  stripe = require('stripe')(stripeKey);
}

/**
 * Create a payment intent for a registration
 * @param {number} registrationId - ID of the registration
 * @param {number} amountCents - Amount in cents (e.g., 1500 = €15.00)
 * @param {string} email - Customer email
 * @returns {object} Payment intent with id and client_secret
 */
async function createPaymentIntent(registrationId, amountCents, email) {
  if (!stripe) {
    // Mock implementation for development without Stripe account
    console.log(`[STRIPE MOCK] Creating payment intent for €${(amountCents / 100).toFixed(2)}`);
    return {
      id: `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      client_secret: `pi_mock_secret_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: amountCents,
      currency: 'eur',
      status: 'requires_payment_method',
      metadata: { registrationId, email }
    };
  }

  // Real Stripe API call
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'eur',
      metadata: {
        registrationId: registrationId.toString(),
        email: email
      },
      automatic_payment_methods: { enabled: true },
      receipt_email: email
    });

    console.log(`[STRIPE] Payment intent created: ${paymentIntent.id}`);
    return paymentIntent;
  } catch (err) {
    console.error('[STRIPE ERROR] Failed to create payment intent:', err.message);
    throw err;
  }
}

/**
 * Retrieve a payment intent from Stripe
 * @param {string} paymentIntentId - Stripe PaymentIntent ID
 * @returns {object} Payment intent details
 */
async function getPaymentIntent(paymentIntentId) {
  if (!stripe) {
    // Mock: always return succeeded for mock payment
    console.log(`[STRIPE MOCK] Retrieving payment intent ${paymentIntentId}`);
    return {
      id: paymentIntentId,
      status: 'succeeded',
      amount: 0,
      currency: 'eur'
    };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log(`[STRIPE] Payment intent retrieved: ${paymentIntentId} (${paymentIntent.status})`);
    return paymentIntent;
  } catch (err) {
    console.error('[STRIPE ERROR] Failed to retrieve payment intent:', err.message);
    throw err;
  }
}

/**
 * Construct and verify a webhook event
 * @param {Buffer} body - Raw webhook request body
 * @param {string} sig - Stripe signature header
 * @returns {object} Verified webhook event
 */
function constructWebhookEvent(body, sig) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    // Mock: return a mock webhook event
    console.log('[STRIPE MOCK] Webhook verification skipped (no secret configured)');
    try {
      return JSON.parse(body);
    } catch {
      return { type: 'payment_intent.succeeded', data: { object: {} } };
    }
  }

  try {
    return stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('[STRIPE ERROR] Webhook signature verification failed:', err.message);
    throw err;
  }
}

/**
 * Check if Stripe is configured
 * @returns {boolean} True if Stripe keys are available
 */
function isConfigured() {
  return !!stripe;
}

module.exports = {
  createPaymentIntent,
  getPaymentIntent,
  constructWebhookEvent,
  isConfigured
};
