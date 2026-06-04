/**
 * PaymentForm - Handles Stripe payment collection and registration completion
 * Works in mock mode (no real Stripe card needed) and real mode (with valid card)
 */

import { useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import './PaymentForm.css';

export default function PaymentForm({
  eventId,
  registrationData,
  selectedProducts,
  teamId,
  comments,
  totalAmount,
  onSuccess,
  onError
}) {
  const stripe = useStripe();
  const elements = useElements();

  const [isProcessing, setIsProcessing] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [error, setError] = useState(null);

  // Format the total amount for display
  const displayAmount = totalAmount ? `€${totalAmount.toFixed(2)}` : null;

  // Step 1: Create payment intent
  const handleCreatePaymentIntent = async () => {
    setError(null);
    setIsProcessing(true);

    try {
      // Collect all products (captain + guests) for payment calculation
      const allProducts = [...selectedProducts];
      if (registrationData?.guests) {
        registrationData.guests.forEach(guest => {
          guest.products.forEach(p => {
            allProducts.push({
              product_id: p.product_id,
              quantity: p.quantity,
              field_values: p.field_values || {}
            });
          });
        });
      }

      const response = await fetch('/api/payments/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          products: allProducts,
          teamId: teamId || null,
          comments: comments || null
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create payment');
      }

      const data = await response.json();

      setMockMode(data.mockMode);

      // In mock mode, auto-confirm without card
      if (data.mockMode) {
        await confirmPayment(data.paymentIntentId);
      } else {
        // Real mode: user must complete Stripe payment
        await handleStripePayment(data.clientSecret, data.paymentIntentId);
      }
    } catch (err) {
      const errorMsg = err.message || 'Payment failed';
      setError(errorMsg);
      onError?.(errorMsg);
      setIsProcessing(false);
    }
  };

  // Step 2a: For real Stripe mode - handle card payment
  const handleStripePayment = async (clientSecret, paymentIntentId) => {
    if (!stripe || !elements) {
      setError('Stripe not loaded');
      setIsProcessing(false);
      return;
    }

    try {
      const cardElement = elements.getElement(CardElement);

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {}
        }
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      if (result.paymentIntent.status === 'succeeded') {
        await confirmPayment(paymentIntentId);
      } else {
        throw new Error(`Payment status: ${result.paymentIntent.status}`);
      }
    } catch (err) {
      const errorMsg = err.message || 'Card payment failed';
      setError(errorMsg);
      onError?.(errorMsg);
      setIsProcessing(false);
    }
  };

  // Step 2b: Confirm payment intent and create registration(s)
  // Sends either full registration data (captain + guests) or just captain data
  const confirmPayment = async (paymentIntentId) => {
    try {
      const payloadData = registrationData || {
        captain: {
          products: selectedProducts,
          teamId: teamId || null,
          comments: comments || null
        }
      };

      const response = await fetch('/api/payments/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId,
          eventId,
          registrations: payloadData
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to confirm payment');
      }

      const data = await response.json();

      console.log('✓ Registration successful:', data);
      onSuccess?.(data);
    } catch (err) {
      const errorMsg = err.message || 'Registration failed';
      setError(errorMsg);
      onError?.(errorMsg);
      setIsProcessing(false);
    }
  };

  return (
    <div className="payment-form">
      <h3>Complete Your Registration</h3>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      <div className="payment-info">
        <p><strong>Total Amount:</strong> {displayAmount || 'Loading...'}</p>
        {mockMode && (
          <div className="mock-badge">
            🧪 Mock Mode: No real payment required for testing
          </div>
        )}
      </div>

      {!mockMode && (
        <div className="card-element-container">
          <label>Card Details</label>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': { color: '#aab7c4' }
                },
                invalid: { color: '#9e2146' }
              }
            }}
          />
        </div>
      )}

      <button
        onClick={handleCreatePaymentIntent}
        disabled={isProcessing || !displayAmount}
        className="payment-button"
      >
        {isProcessing ? 'Processing...' : `Pay ${displayAmount || ''}`}
      </button>

      <p className="payment-note">
        {mockMode
          ? 'Testing in mock mode. No real payment will be processed.'
          : 'Your payment is secure and encrypted.'}
      </p>
    </div>
  );
}
