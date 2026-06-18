/**
 * PaymentForm - Handles Stripe payment collection and registration completion
 * Uses Payment Element for multiple payment methods (card, Apple Pay, Google Pay, etc.)
 */

import { useState, useEffect } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { stripePromise, stripeLivePromise, stripeTestPromise } from './StripeProvider';
import './PaymentForm.css';

// Inner component that uses Stripe hooks (must be inside Elements provider)
function PaymentFormContent({
  clientSecret,
  paymentIntentId,
  mockMode,
  isProcessing,
  error,
  displayAmount,
  selectedProducts,
  registrationData,
  teamId,
  comments,
  totalAmount,
  eventId,
  setError,
  setIsProcessing,
  onSuccess,
  onError
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleConfirmPayment = async () => {
    if (!clientSecret || !paymentIntentId) {
      setError('Payment not initialized');
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      // In mock mode, skip Stripe confirmation
      if (mockMode) {
        await confirmPaymentRegistration(paymentIntentId);
        return;
      }

      // Real mode: confirm payment with Stripe
      if (!stripe || !elements) {
        setError('Stripe not loaded');
        setIsProcessing(false);
        return;
      }

      // Submit the payment element (required for Payment Element)
      const submitResult = await elements.submit();
      if (submitResult.error) {
        throw new Error(submitResult.error.message);
      }

      // For additional payments (no eventId), use /events/checkout; for normal payments use /events/:id/checkout
      const returnPath = registrationData?.isAdditionalPayment
        ? '/events/checkout'
        : `/events/${eventId}/checkout`;

      // Build return URL with appropriate parameters
      let returnUrl = `${window.location.origin}${returnPath}?paymentIntentId=${paymentIntentId}`;
      if (registrationData?.isAdditionalPayment) {
        // Include clientSecret for additional payments so we can detect them on redirect
        returnUrl += `&clientSecret=${clientSecret}`;
      }

      const result = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: returnUrl
        }
      });

      // If we get here, payment didn't require redirect
      if (result.error) {
        throw new Error(result.error.message);
      }

      if (result.paymentIntent.status === 'succeeded') {
        await confirmPaymentRegistration(paymentIntentId);
      } else {
        throw new Error(`Payment status: ${result.paymentIntent.status}`);
      }
    } catch (err) {
      const errorMsg = err.message || 'Payment failed';
      setError(errorMsg);
      onError?.(errorMsg);
      setIsProcessing(false);
    }
  };

  const confirmPaymentRegistration = async (paymentIntentId) => {
    try {
      const payloadData = registrationData || {
        captain: {
          products: selectedProducts,
          teamId: teamId || null,
          comments: comments || null
        }
      };

      const expectedAmount = Math.round(totalAmount * 100);

      const response = await fetch('/api/payments/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId,
          eventId,
          registrations: payloadData,
          expectedAmount
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
    <>
      {!mockMode && clientSecret && (
        <div className="card-element-container">
          <PaymentElement options={{ layout: 'accordion' }} />
        </div>
      )}

      <button
        onClick={handleConfirmPayment}
        disabled={isProcessing || !displayAmount || !stripe || !elements}
        className="payment-button"
      >
        {isProcessing ? 'Processing...' : `Pay ${displayAmount || ''}`}
      </button>

      <p className="payment-note">
        {mockMode
          ? 'Testing in mock mode. No real payment will be processed.'
          : 'Your payment is secure and encrypted.'}
      </p>
    </>
  );
}

// Outer component that manages payment intent creation
export default function PaymentForm({
  eventId,
  registrationData,
  selectedProducts,
  teamId,
  comments,
  totalAmount,
  stripeMode = 'live',
  onSuccess,
  onError
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mockMode, setMockMode] = useState(false);
  const [error, setError] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);

  // Select the correct Stripe promise based on mode
  const selectedStripePromise = stripeMode === 'test' ? stripeTestPromise : stripeLivePromise;
  const activeStripePromise = selectedStripePromise || stripePromise; // Fallback to default

  const displayAmount = totalAmount ? `€${totalAmount.toFixed(2)}` : null;

  // Create payment intent on mount (or use existing for additional payments)
  useEffect(() => {
    // For additional payments, use the clientSecret from registrationData
    if (registrationData?.isAdditionalPayment && registrationData?.clientSecret) {
      setClientSecret(registrationData.clientSecret);
      setPaymentIntentId(registrationData.paymentIntentId);
      setIsLoading(false);
      return;
    }

    if (!totalAmount || !eventId) {
      setIsLoading(false);
      return;
    }

    const createIntent = async () => {
      setError(null);
      setIsLoading(true);

      try {
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
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
        setMockMode(data.mockMode);
      } catch (err) {
        const errorMsg = err.message || 'Failed to initialize payment';
        setError(errorMsg);
        onError?.(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    createIntent();
  }, [eventId, totalAmount, selectedProducts, registrationData, teamId, comments, onError]);

  if (isLoading) {
    return (
      <div className="payment-form">
        <h3>Complete Your Registration</h3>
        <p>Initializing payment...</p>
      </div>
    );
  }

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

      {clientSecret && (
        <Elements stripe={activeStripePromise} options={{ clientSecret }}>
          <PaymentFormContent
            clientSecret={clientSecret}
            paymentIntentId={paymentIntentId}
            mockMode={mockMode}
            isProcessing={isProcessing}
            error={error}
            displayAmount={displayAmount}
            selectedProducts={selectedProducts}
            registrationData={registrationData}
            teamId={teamId}
            comments={comments}
            totalAmount={totalAmount}
            eventId={eventId}
            setError={setError}
            setIsProcessing={setIsProcessing}
            onSuccess={onSuccess}
            onError={onError}
          />
        </Elements>
      )}
    </div>
  );
}
