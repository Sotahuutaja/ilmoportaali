/**
 * StripeProvider - Wraps the app with Stripe Elements context
 * Makes Stripe functionality available to all child components
 */

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

// Load Stripe for both test and live modes
const publishableKeyLive = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const publishableKeyTest = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_TEST;

let stripeLivePromise = null;
let stripeTestPromise = null;
let stripePromise = null; // Default/fallback promise

// Initialize live mode
if (publishableKeyLive && publishableKeyLive !== 'pk_test_mock_key') {
  stripeLivePromise = loadStripe(publishableKeyLive);
} else {
  stripeLivePromise = Promise.resolve(null);
}

// Initialize test mode
if (publishableKeyTest && publishableKeyTest !== 'pk_test_mock_key') {
  stripeTestPromise = loadStripe(publishableKeyTest);
} else {
  stripeTestPromise = Promise.resolve(null);
}

// Default to live, or test if live not configured
stripePromise = stripeLivePromise || stripeTestPromise || Promise.resolve(null);

if (!publishableKeyLive && !publishableKeyTest) {
  console.log('[STRIPE MOCK] Running in mock mode. Real Stripe not configured.');
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
