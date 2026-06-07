/**
 * StripeProvider - Wraps the app with Stripe Elements context
 * Makes Stripe functionality available to all child components
 */

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

// Load Stripe or use mock if not configured
let stripePromise = null;

const publishableKey = process.env.VITE_STRIPE_PUBLISHABLE_KEY;

console.log('[STRIPE DEBUG] publishableKey =', publishableKey);
console.log('[STRIPE DEBUG] All env vars starting with VITE_:', Object.keys(process.env).filter(k => k.startsWith('VITE_')));

if (publishableKey && publishableKey !== 'pk_test_mock_key') {
  // Real Stripe account configured
  console.log('[STRIPE] Loading real Stripe with publishable key');
  stripePromise = loadStripe(publishableKey);
} else {
  // Mock mode - create a dummy promise that resolves to null
  console.log('[STRIPE MOCK] Running in mock mode. Real Stripe not configured.');
  console.log('[STRIPE DEBUG] Reason: publishableKey =', publishableKey);
  stripePromise = Promise.resolve(null);
}

export default function StripeProvider({ children }) {
  // In mock mode, stripe is null, so Elements won't render
  // This is safe - CardElement will still work with mock payment flow
  return (
    <Elements stripe={stripePromise} options={{}}>
      {children}
    </Elements>
  );
}
