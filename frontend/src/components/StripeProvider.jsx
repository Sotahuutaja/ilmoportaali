/**
 * StripeProvider - Wraps the app with Stripe Elements context
 * Makes Stripe functionality available to all child components
 */

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/js';

// Load Stripe or use mock if not configured
let stripePromise = null;

const publishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;

if (publishableKey && publishableKey !== 'pk_test_mock_key') {
  // Real Stripe account configured
  stripePromise = loadStripe(publishableKey);
} else {
  // Mock mode - create a dummy promise that resolves to null
  console.log('[STRIPE MOCK] Running in mock mode. Real Stripe not configured.');
  stripePromise = Promise.resolve(null);
}

export default function StripeProvider({ children }) {
  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  );
}
