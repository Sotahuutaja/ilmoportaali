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
      status: 'requires_capture',
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
      receipt_email: email,
      // Manual capture, scoped to cards only: a card is authorized (funds held) when the
      // customer confirms, but not actually charged until we explicitly capture it once
      // the registration has been fully validated and saved (see capturePaymentIntent()).
      // Other payment methods (e.g. MobilePay, iDEAL) settle instantly and many of them
      // don't support delayed capture at all, so they're left on Stripe's normal automatic
      // capture — for those, confirm-payment falls back to the refund-on-failure safety
      // net (see refundPaymentIntent()) instead of capture-after-validation.
      payment_method_options: {
        card: { capture_method: 'manual' }
      }
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
        status: stored.status,
        amount: stored.amount,
        currency: 'eur',
        metadata: stored.metadata
      };
    }
    return {
      id: paymentIntentId,
      status: 'requires_capture',
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
 * Capture a previously-authorized (manual capture) payment intent — this is the step
 * that actually takes the customer's money. Call this only once the registration it
 * pays for has been fully validated and is ready to be saved, so a payment is never
 * captured without a corresponding registration succeeding alongside it.
 * @param {string} paymentIntentId - Stripe PaymentIntent ID
 * @param {string} mode - 'live' or 'test' (default: 'live')
 * @returns {object} The captured payment intent
 */
async function capturePaymentIntent(paymentIntentId, mode = 'live') {
  const stripeInstance = getStripeInstance(mode);

  if (!stripeInstance) {
    const modeLabel = mode === 'test' ? '[STRIPE TEST MOCK]' : '[STRIPE LIVE MOCK]';
    console.log(`${modeLabel} Capturing payment intent ${paymentIntentId}`);
    const stored = mockPaymentIntents[paymentIntentId];
    if (stored) {
      stored.status = 'succeeded';
      return { id: paymentIntentId, status: 'succeeded', amount: stored.amount, currency: 'eur', metadata: stored.metadata };
    }
    return { id: paymentIntentId, status: 'succeeded', amount: 0, currency: 'eur', metadata: {} };
  }

  try {
    const paymentIntent = await stripeInstance.paymentIntents.capture(paymentIntentId);
    const modeLabel = mode === 'test' ? '[STRIPE TEST]' : '[STRIPE LIVE]';
    console.log(`${modeLabel} Payment intent captured: ${paymentIntentId} (${paymentIntent.status})`);
    return paymentIntent;
  } catch (err) {
    console.error('[STRIPE ERROR] Failed to capture payment intent:', err.message);
    throw err;
  }
}

/**
 * Cancel a previously-authorized (manual capture) payment intent that we've decided not
 * to capture — e.g. registration validation failed after the card was authorized but
 * before we took any money. This releases the hold on the customer's card; no funds
 * are ever taken, so no refund is needed.
 * @param {string} paymentIntentId - Stripe PaymentIntent ID
 * @param {string} mode - 'live' or 'test' (default: 'live')
 * @returns {object} The canceled payment intent
 */
async function cancelPaymentIntent(paymentIntentId, mode = 'live') {
  const stripeInstance = getStripeInstance(mode);

  if (!stripeInstance) {
    const modeLabel = mode === 'test' ? '[STRIPE TEST MOCK]' : '[STRIPE LIVE MOCK]';
    console.log(`${modeLabel} Canceling payment intent ${paymentIntentId}`);
    const stored = mockPaymentIntents[paymentIntentId];
    if (stored) {
      stored.status = 'canceled';
      return { id: paymentIntentId, status: 'canceled', amount: stored.amount, currency: 'eur', metadata: stored.metadata };
    }
    return { id: paymentIntentId, status: 'canceled', amount: 0, currency: 'eur', metadata: {} };
  }

  try {
    const paymentIntent = await stripeInstance.paymentIntents.cancel(paymentIntentId);
    const modeLabel = mode === 'test' ? '[STRIPE TEST]' : '[STRIPE LIVE]';
    console.log(`${modeLabel} Payment intent canceled: ${paymentIntentId} (${paymentIntent.status})`);
    return paymentIntent;
  } catch (err) {
    console.error('[STRIPE ERROR] Failed to cancel payment intent:', err.message);
    throw err;
  }
}

/**
 * Refund a payment intent that was already captured — the safety net for payment methods
 * that settle (auto-capture) immediately, such as MobilePay or iDEAL, which don't support
 * holding funds via manual capture. Used when a registration fails validation or fails to
 * save AFTER the customer's money has already been taken, so they're never simply left
 * charged with nothing to show for it.
 * @param {string} paymentIntentId - Stripe PaymentIntent ID
 * @param {string} mode - 'live' or 'test' (default: 'live')
 * @returns {object} The refund object
 */
async function refundPaymentIntent(paymentIntentId, mode = 'live') {
  const stripeInstance = getStripeInstance(mode);

  if (!stripeInstance) {
    const modeLabel = mode === 'test' ? '[STRIPE TEST MOCK]' : '[STRIPE LIVE MOCK]';
    console.log(`${modeLabel} Refunding payment intent ${paymentIntentId}`);
    const stored = mockPaymentIntents[paymentIntentId];
    if (stored) {
      stored.status = 'refunded';
      return { id: `re_mock_${Date.now()}`, payment_intent: paymentIntentId, status: 'succeeded', amount: stored.amount };
    }
    return { id: `re_mock_${Date.now()}`, payment_intent: paymentIntentId, status: 'succeeded', amount: 0 };
  }

  try {
    const refund = await stripeInstance.refunds.create({ payment_intent: paymentIntentId });
    const modeLabel = mode === 'test' ? '[STRIPE TEST]' : '[STRIPE LIVE]';
    console.log(`${modeLabel} Payment intent refunded: ${paymentIntentId} (refund ${refund.id}, status ${refund.status})`);
    return refund;
  } catch (err) {
    console.error('[STRIPE ERROR] Failed to refund payment intent:', err.message);
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
  capturePaymentIntent,
  cancelPaymentIntent,
  refundPaymentIntent,
  constructWebhookEvent,
  isConfigured,
  getStripeInstance
};
