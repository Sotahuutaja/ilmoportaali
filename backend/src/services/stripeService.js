/**
 * Stripe payment service
 * Handles PaymentIntent creation, confirmation, and status checks
 * Supports both test and live mode with separate Stripe instances
 * Uses mock implementation if keys are not configured
 */

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeSecretKeyTest = process.env.STRIPE_SECRET_KEY_TEST;

let stripeLive = null;
let stripeTest = null;

// Only initialize Stripe instances if keys are configured
if (stripeSecretKey) {
  stripeLive = require('stripe')(stripeSecretKey);
}

if (stripeSecretKeyTest) {
  stripeTest = require('stripe')(stripeSecretKeyTest);
}

// For backward compatibility, default to live
let stripe = stripeLive;

/**
 * Get the appropriate Stripe instance based on mode
 * @param {string} mode - 'live' or 'test'
 * @returns {object} Stripe instance or null if not configured
 */
function getStripeInstance(mode = 'live') {
  if (mode === 'test') {
    return stripeTest || stripeLive; // Fall back to live if test not configured
  }
  return stripeLive || stripeTest; // Fall back to test if live not configured
}

// In-memory storage for mock payment intents (to persist metadata across calls)
const mockPaymentIntents = {};

/**
 * Create a payment intent for a registration
 * @param {number} registrationId - ID of the registration
 * @param {number} amountCents - Amount in cents (e.g., 1500 = €15.00)
 * @param {string} email - Customer email
 * @param {string} mode - 'live' or 'test' (default: 'live')
 * @returns {object} Payment intent with id and client_secret
 */
async function createPaymentIntent(registrationId, amountCents, email, mode = 'live') {
  const stripeInstance = getStripeInstance(mode);

  if (!stripeInstance) {
    // Mock implementation for development without Stripe account
    const modeLabel = mode === 'test' ? '[STRIPE TEST MOCK]' : '[STRIPE LIVE MOCK]';
    console.log(`${modeLabel} Creating payment intent for €${(amountCents / 100).toFixed(2)}`);
    const mockIntent = {
      id: `pi_${mode}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      client_secret: `pi_${mode}_secret_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: amountCents,
      currency: 'eur',
      status: 'requires_payment_method',
      metadata: { registrationId, email, mode }
    };
    // Store in mock map so we can retrieve it later with metadata intact
    mockPaymentIntents[mockIntent.id] = mockIntent;
    return mockIntent;
  }

  // Real Stripe API call
  try {
    const paymentIntent = await stripeInstance.paymentIntents.create({
      amount: amountCents,
      currency: 'eur',
      metadata: {
        registrationId: registrationId ? registrationId.toString() : 'pending',
        email: email,
        mode: mode
      },
      automatic_payment_methods: { enabled: true },
      receipt_email: email
    });

    const modeLabel = mode === 'test' ? '[STRIPE TEST]' : '[STRIPE LIVE]';
    console.log(`${modeLabel} Payment intent created: ${paymentIntent.id}`);
    return paymentIntent;
  } catch (err) {
    console.error('[STRIPE ERROR] Failed to create payment intent:', err.message);
    throw err;
  }
}

/**
 * Retrieve a payment intent from Stripe
 * @param {string} paymentIntentId - Stripe PaymentIntent ID
 * @param {string} mode - 'live' or 'test' (default: 'live')
 * @returns {object} Payment intent details
 */
async function getPaymentIntent(paymentIntentId, mode = 'live') {
  const stripeInstance = getStripeInstance(mode);

  if (!stripeInstance) {
    // Mock: retrieve from storage if available, otherwise return basic mock
    const modeLabel = mode === 'test' ? '[STRIPE TEST MOCK]' : '[STRIPE LIVE MOCK]';
    console.log(`${modeLabel} Retrieving payment intent ${paymentIntentId}`);
    const stored = mockPaymentIntents[paymentIntentId];
    if (stored) {
      return {
        id: paymentIntentId,
        status: 'succeeded',
        amount: stored.amount,
        currency: 'eur',
        metadata: stored.metadata
      };
    }
    return {
      id: paymentIntentId,
      status: 'succeeded',
      amount: 0,
      currency: 'eur',
      metadata: {}
    };
  }

  try {
    const paymentIntent = await stripeInstance.paymentIntents.retrieve(paymentIntentId);
    const modeLabel = mode === 'test' ? '[STRIPE TEST]' : '[STRIPE LIVE]';
    console.log(`${modeLabel} Payment intent retrieved: ${paymentIntentId} (${paymentIntent.status})`);
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
 * @param {string} mode - 'live' or 'test' (default: 'live')
 * @returns {boolean} True if Stripe key is available for the mode
 */
function isConfigured(mode = 'live') {
  const stripeInstance = getStripeInstance(mode);
  return !!stripeInstance;
}

module.exports = {
  createPaymentIntent,
  getPaymentIntent,
  constructWebhookEvent,
  isConfigured,
  getStripeInstance
};
