/**
 * StripeProvider - Wraps the app with Stripe Elements context
 * Makes Stripe functionality available to all child components
 * Supports both live and test mode Stripe keys
 */

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

// Load Stripe keys for both modes
let stripeLivePromise = null;
let stripeTestPromise = null;
let stripePromise = null; // Default to live for backward compatibility

const publishableKeyLive = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const publishableKeyTest = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_TEST;

// Load live mode Stripe
if (publishableKeyLive && publishableKeyLive !== 'pk_test_mock_key') {
  stripeLivePromise = loadStripe(publishableKeyLive);
  stripePromise = stripeLivePromise; // Default to live
} else {
  console.log('[STRIPE MOCK] Live mode Stripe not configured.');
  stripeLivePromise = Promise.resolve(null);
}

// Load test mode Stripe
if (publishableKeyTest && publishableKeyTest !== 'pk_test_mock_key') {
  stripeTestPromise = loadStripe(publishableKeyTest);
} else {
  console.log('[STRIPE MOCK] Test mode Stripe not configured.');
  stripeTestPromise = Promise.resolve(null);
}

// If only test mode is configured, use it as default
if (!stripeLivePromise && stripeTestPromise) {
  stripePromise = stripeTestPromise;
}

export { stripePromise, stripeLivePromise, stripeTestPromise };

export default function StripeProvider({ children, clientSecret }) {
  // For PaymentElement, we need to pass clientSecret to Elements
  const options = clientSecret ? { clientSecret } : {};

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}
