/**
 * Checkout Page - Dedicated payment page for event registration
 * User is redirected here after selecting products
 */

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import PaymentForm from '../components/PaymentForm';
import { formatDateTime } from '../utils/datetime';

export default function Checkout() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [teamId, setTeamId] = useState(null);
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(false);
  const [registrationData, setRegistrationData] = useState(null); // Full captain + guests data
  const [paymentSuccess, setPaymentSuccess] = useState(null);

  useEffect(() => {
    // Check if returning from payment redirect
    const redirectStatus = searchParams.get('redirect_status');
    const paymentIntentId = searchParams.get('paymentIntentId') || searchParams.get('payment_intent');
    const clientSecret = searchParams.get('clientSecret');

    console.log('[CHECKOUT] URL params:', { redirectStatus, paymentIntentId, clientSecret: !!clientSecret, id });
    console.log('[CHECKOUT] localStorage keys:', Object.keys(localStorage));

    // Handle additional payment (paymentIntentId from email link)
    if (paymentIntentId && clientSecret && !redirectStatus) {
      console.log('[CHECKOUT] Detected additional payment scenario');
      // For additional payments, set minimal data with just the payment intent info
      setRegistrationData({
        isAdditionalPayment: true,
        paymentIntentId: paymentIntentId,
        clientSecret: clientSecret
      });
      setLoading(false);
      return;
    }

    // Redirect if not logged in
    if (!user) {
      navigate(`/events/${id}`);
      return;
    }

    if (redirectStatus && paymentIntentId) {
      console.log('[CHECKOUT] Detected payment redirect');
      setIsProcessingRedirect(true);
      // Returning from payment provider - retrieve stored registration data and confirm
      const storageKey = `checkout_${id}`;
      console.log('[CHECKOUT] Looking for storage key:', storageKey);
      const saved = localStorage.getItem(storageKey);
      console.log('[CHECKOUT] Found saved data:', !!saved);

      if (saved) {
        try {
          const regData = JSON.parse(saved);
          console.log('[CHECKOUT] Parsed registration data:', regData);
          handlePaymentRedirectSuccess(paymentIntentId, regData);
          return;
        } catch (err) {
          console.error('Failed to process payment redirect:', err);
          setError('Failed to process payment redirect');
          setIsProcessingRedirect(false);
        }
      } else {
        console.warn('[CHECKOUT] No saved registration data found');
        setError('Payment redirect detected but no registration data found');
        setIsProcessingRedirect(false);
      }
    }

    // Fetch event and products (only if we have an id)
    if (!id) {
      setError('Event ID is required');
      setLoading(false);
      return;
    }

    Promise.all([
      api.get(`/events/${id}`),
      api.get(`/events/${id}/products`)
    ])
      .then(([eventRes, productsRes]) => {
        setEvent(eventRes.data.event);
        setProducts(productsRes.data.products);

        // Parse URL parameters
        try {
          const registrationsParam = searchParams.get('registrations');

          if (registrationsParam) {
            const regData = JSON.parse(decodeURIComponent(registrationsParam));
            // Store full registration data for payment processing
            setRegistrationData(regData);
            // Persist to localStorage for recovery after page refresh
            localStorage.setItem(`checkout_${id}`, JSON.stringify(regData));

            if (regData.captain) {
              setSelectedProducts(regData.captain.products);
              setTeamId(regData.captain.teamId);
              setComments(regData.captain.comments);
            }
          } else {
            // Try to restore from localStorage if available
            const saved = localStorage.getItem(`checkout_${id}`);
            if (saved) {
              try {
                const regData = JSON.parse(saved);
                setRegistrationData(regData);

                if (regData.captain) {
                  setSelectedProducts(regData.captain.products);
                  setTeamId(regData.captain.teamId);
                  setComments(regData.captain.comments);
                }
              } catch (err) {
                console.error('Failed to restore checkout data from localStorage');
              }
            }
          }
        } catch (err) {
          setError('Invalid checkout parameters');
        }

        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load event details');
        setLoading(false);
      });
  }, [id, user, navigate, searchParams]);

  const handlePaymentSuccess = (paymentData) => {
    console.log('[CHECKOUT] handlePaymentSuccess called with:', paymentData);
    // Clear checkout data from localStorage after successful payment
    localStorage.removeItem(`checkout_${id}`);

    // Show success message on this page
    setPaymentSuccess({
      registrationId: paymentData.registrationId,
      invoiceNumber: paymentData.invoiceNumber,
      amount: paymentData.amountFormatted
    });
    console.log('[CHECKOUT] paymentSuccess state updated');
  };

  const handlePaymentError = (errorMessage) => {
    setError(errorMessage);
  };

  const handlePaymentRedirectSuccess = async (paymentIntentId, registrationData) => {
    // User returning from payment provider redirect (e.g., MobilePay, iDEAL)
    // For asynchronous payments, Stripe will send webhooks when payment completes
    // We'll attempt to confirm, but payment might still be processing
    console.log('[CHECKOUT] Processing payment redirect for intent:', paymentIntentId);
    setError('');

    try {
      // Determine total amount from stored registration data
      let totalAmount = 0;

      // Captain's products
      if (registrationData.captain?.products) {
        totalAmount += registrationData.captain.products.reduce((sum, p) => {
          return sum + (p.price * p.quantity);
        }, 0);
      }

      // Guests' products
      if (registrationData.guests) {
        totalAmount += registrationData.guests.reduce((sum, guest) => {
          return sum + (guest.products?.reduce((guestSum, p) => {
            return guestSum + (p.price * p.quantity);
          }, 0) || 0);
        }, 0);
      }

      const expectedAmount = Math.round(totalAmount * 100);

      console.log('[CHECKOUT] Confirming payment with backend');
      // Confirm payment with backend
      const response = await api.post('/payments/confirm-payment', {
        paymentIntentId,
        eventId: parseInt(id),
        registrations: registrationData,
        expectedAmount
      });

      if (!response.data) {
        throw new Error('Failed to confirm payment');
      }

      console.log('[CHECKOUT] Payment confirmed successfully');
      console.log('[CHECKOUT] Response data:', response.data);
      handlePaymentSuccess({
        registrationId: response.data.registrationId,
        invoiceNumber: response.data.invoiceNumber,
        amountFormatted: response.data.amountFormatted
      });
      console.log('[CHECKOUT] Setting isProcessingRedirect to false and loading to false');
      setIsProcessingRedirect(false);
      setLoading(false);
    } catch (err) {
      console.error('[CHECKOUT] Payment redirect confirmation error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to complete payment';
      setError(errorMsg);
      setIsProcessingRedirect(false);
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(`/events/${id}`);
  };

  // Helper to get readable field label from product fields
  const getFieldLabel = (fieldId) => {
    for (const product of products) {
      if (product.fields) {
        const field = product.fields.find(f => f.id === fieldId);
        if (field) return field.label || field.name || fieldId;
      }
    }
    return fieldId;
  };

  // Helper to format field_values for display
  const formatFieldValues = (fieldValues, productId) => {
    if (!fieldValues || Object.keys(fieldValues).length === 0) return '';
    return Object.entries(fieldValues)
      .map(([fieldId, value]) => `${getFieldLabel(fieldId)}: ${value}`)
      .join(', ');
  };

  // Helper to get product price with option overrides
  const getProductPrice = (productId, fieldValues) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;

    let price = parseFloat(product.price);
    const fields = product.fields || [];

    // Check if any field option has a custom price override
    if (fieldValues && fields.length > 0) {
      for (const field of fields) {
        if (field.type === 'select') {
          const selectedValue = fieldValues[field.id];
          if (selectedValue && field.options) {
            const option = field.options.find(opt => {
              const optVal = typeof opt === 'string' ? opt : opt.value;
              return optVal === selectedValue;
            });

            if (option && typeof option === 'object' && option.price !== null && option.price !== undefined) {
              price = parseFloat(option.price);
              break;
            }
          }
        }
      }
    }

    return price;
  };

  if (!user) {
    return (
      <div style={{ maxWidth: 640, margin: '2rem auto' }}>
        <div className="card">
          <p>Please <a href="/login">log in</a> to complete checkout.</p>
        </div>
      </div>
    );
  }

  if (isProcessingRedirect) {
    return (
      <div style={{ maxWidth: 640, margin: '2rem auto' }}>
        <div className="card">
          <h2>Processing Payment</h2>
          <p>Your payment is being processed. Please wait...</p>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: '2rem auto' }}>
        <div className="card">
          <p>Loading checkout...</p>
        </div>
      </div>
    );
  }

  // Show success message if payment was successful (even if event details are still loading)
  if (paymentSuccess) {
    return (
      <div style={{ maxWidth: 640, margin: '2rem auto' }}>
        <div className="card">
          <div style={{
            background: '#d4edda',
            border: '1px solid #c3e6cb',
            color: '#155724',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>✓ Payment Successful!</h3>
            <p style={{ margin: '0.3rem 0', fontSize: '0.95rem' }}>
              Your registration has been confirmed.
            </p>
            <p style={{ margin: '0.3rem 0', fontSize: '0.95rem' }}>
              Registration ID: <code style={{ background: 'rgba(0,0,0,0.1)', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>{paymentSuccess.registrationId}</code>
            </p>
            <p style={{ margin: '0.3rem 0', fontSize: '0.95rem' }}>
              Invoice: <code style={{ background: 'rgba(0,0,0,0.1)', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>{paymentSuccess.invoiceNumber}</code>
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#0c5460', fontWeight: 500 }}>
              A confirmation email has been sent to your email address.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => navigate(`/events/${id}`)}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              Back to event
            </button>
            <button
              onClick={() => navigate('/')}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Back to events
            </button>
          </div>
        </div>
      </div>
    );
  }

  // For additional payments, we don't need event details - skip this check
  if (!event && !registrationData?.isAdditionalPayment) {
    return (
      <div style={{ maxWidth: 640, margin: '2rem auto' }}>
        <div className="card">
          <p className="error">Event not found</p>
        </div>
      </div>
    );
  }

  // Build the products array for PaymentForm and calculate total
  const paymentProducts = selectedProducts
    .filter(p => p.quantity > 0)
    .map(p => ({
      product_id: p.product_id,
      quantity: p.quantity,
      field_values: p.field_values || {}
    }));

  // Calculate total amount from all registrations (captain + guests)
  let totalAmount = 0;

  // Add captain's products with option-aware pricing
  totalAmount += paymentProducts.reduce((sum, p) => {
    const price = getProductPrice(p.product_id, p.field_values);
    return sum + (price * p.quantity);
  }, 0);

  // Add guests' products with option-aware pricing
  if (registrationData?.guests) {
    totalAmount += registrationData.guests.reduce((sum, guest) => {
      return sum + (guest.products?.reduce((guestSum, p) => {
        const price = getProductPrice(p.product_id, p.field_values);
        return guestSum + (price * p.quantity);
      }, 0) || 0);
    }, 0);
  }

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto' }}>
      <div className="card">
        <h2>Checkout</h2>
        {event && (
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Event: <strong>{event.title}</strong><br />
            📍 {event.location} | 📅 {formatDateTime(event.starts_at)}
          </p>
        )}
        {registrationData?.isAdditionalPayment && (
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            <strong>Complete Additional Payment</strong>
          </p>
        )}

        {error && <p className="error">{error}</p>}

        {/* Selected Products Summary - All Registrations (hide for additional payments) */}
        {!registrationData?.isAdditionalPayment && (
        <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.1rem' }}>Registration Summary</h3>
          
          {/* Captain's products */}
          {paymentProducts.length > 0 && (
            <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 600 }}>You (Captain)</p>
              {paymentProducts.map((p, idx) => {
                const product = products.find(prod => prod.id === p.product_id);
                const price = getProductPrice(p.product_id, p.field_values);
                const fieldValuesText = formatFieldValues(p.field_values, p.product_id);
                return (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', fontSize: '0.95rem' }}>
                      <span>{product?.name || 'Unknown'} ×{p.quantity}</span>
                      <span>€{(price * p.quantity).toFixed(2)}</span>
                    </div>
                    {fieldValuesText && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '0.5rem', marginBottom: '0.3rem' }}>
                        {fieldValuesText}
                      </div>
                    )}
                  </div>
                );
              })}
              {comments && (
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong>Comments:</strong> {comments}
                </div>
              )}
            </div>
          )}

          {/* Guests' products */}
          {registrationData?.guests && registrationData.guests.length > 0 && (
            registrationData.guests.map((guest, gIdx) => (
              <div key={gIdx} style={{ marginBottom: gIdx < registrationData.guests.length - 1 ? '1rem' : '0', paddingBottom: gIdx < registrationData.guests.length - 1 ? '1rem' : '0', borderBottom: gIdx < registrationData.guests.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 600 }}>Guest: {guest.guest_first_name} {guest.guest_last_name}</p>
                {guest.products.map((p, idx) => {
                  const price = getProductPrice(p.product_id, p.field_values);
                  const fieldValuesText = formatFieldValues(p.field_values, p.product_id);
                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', fontSize: '0.95rem' }}>
                        <span>{p.name} ×{p.quantity}</span>
                        <span>€{(price * p.quantity).toFixed(2)}</span>
                      </div>
                      {fieldValuesText && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '0.5rem', marginBottom: '0.3rem' }}>
                          {fieldValuesText}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}

          {paymentProducts.length === 0 && (!registrationData?.guests || registrationData.guests.length === 0) && (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>No products selected</p>
          )}
        </div>
        )}

        {/* Success Message */}
        {paymentSuccess ? (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{
              background: '#d4edda',
              border: '1px solid #c3e6cb',
              color: '#155724',
              padding: '1rem',
              borderRadius: '6px',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>✓ Payment Successful!</h3>
              <p style={{ margin: '0.3rem 0', fontSize: '0.95rem' }}>
                Your {event ? `registration for ${event.title}` : 'additional payment'} has been confirmed.
              </p>
              <p style={{ margin: '0.3rem 0', fontSize: '0.95rem' }}>
                Registration ID: <code style={{ background: 'rgba(0,0,0,0.1)', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>{paymentSuccess.registrationId}</code>
              </p>
              <p style={{ margin: '0.3rem 0', fontSize: '0.95rem' }}>
                Invoice: <code style={{ background: 'rgba(0,0,0,0.1)', padding: '0.2rem 0.4rem', borderRadius: '3px' }}>{paymentSuccess.invoiceNumber}</code>
              </p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#0c5460', fontWeight: 500 }}>
                A confirmation email has been sent to your email address.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => navigate(`/events/${id}`)}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Back to event
              </button>
              <button
                onClick={() => navigate('/')}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Back to events
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Payment Form */}
            {(paymentProducts.length > 0 || (registrationData?.guests && registrationData.guests.length > 0) || registrationData?.isAdditionalPayment) && (
              <>
                <PaymentForm
                  eventId={id ? parseInt(id) : null}
                  registrationData={registrationData}
                  selectedProducts={paymentProducts}
                  teamId={teamId}
                  comments={comments}
                  totalAmount={totalAmount}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />

                <button
                  onClick={handleCancel}
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: '1rem' }}
                >
                  Cancel and go back
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
