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
  const [registrationData, setRegistrationData] = useState(null); // Full captain + guests data
  const [paymentSuccess, setPaymentSuccess] = useState(null);

  useEffect(() => {
    // Redirect if not logged in
    if (!user) {
      navigate(`/events/${id}`);
      return;
    }

    // Fetch event and products
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

            if (regData.captain) {
              setSelectedProducts(regData.captain.products);
              setTeamId(regData.captain.teamId);
              setComments(regData.captain.comments);
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
    // Show success message on this page
    setPaymentSuccess({
      registrationId: paymentData.registrationId,
      invoiceNumber: paymentData.invoiceNumber,
      amount: paymentData.amountFormatted
    });
  };

  const handlePaymentError = (errorMessage) => {
    setError(errorMessage);
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

  if (!user) {
    return (
      <div style={{ maxWidth: 640, margin: '2rem auto' }}>
        <div className="card">
          <p>Please <a href="/login">log in</a> to complete checkout.</p>
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

  if (!event) {
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

  // Add captain's products
  totalAmount += paymentProducts.reduce((sum, p) => {
    const product = products.find(prod => prod.id === p.product_id);
    return sum + (parseFloat(product?.price || 0) * p.quantity);
  }, 0);

  // Add guests' products
  if (registrationData?.guests) {
    totalAmount += registrationData.guests.reduce((sum, guest) => {
      return sum + (guest.products?.reduce((guestSum, p) => {
        return guestSum + (p.price * p.quantity);
      }, 0) || 0);
    }, 0);
  }

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto' }}>
      <div className="card">
        <h2>Checkout</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Event: <strong>{event.title}</strong><br />
          📍 {event.location} | 📅 {formatDateTime(event.starts_at)}
        </p>

        {error && <p className="error">{error}</p>}

        {/* Selected Products Summary - All Registrations */}
        <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.1rem' }}>Registration Summary</h3>
          
          {/* Captain's products */}
          {paymentProducts.length > 0 && (
            <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 600 }}>You (Captain)</p>
              {paymentProducts.map((p, idx) => {
                const product = products.find(prod => prod.id === p.product_id);
                const fieldValuesText = formatFieldValues(p.field_values, p.product_id);
                return (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', fontSize: '0.95rem' }}>
                      <span>{product?.name || 'Unknown'} ×{p.quantity}</span>
                      <span>€{(parseFloat(product?.price || 0) * p.quantity).toFixed(2)}</span>
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
                  const fieldValuesText = formatFieldValues(p.field_values, p.product_id);
                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', fontSize: '0.95rem' }}>
                        <span>{p.name} ×{p.quantity}</span>
                        <span>€{(p.price * p.quantity).toFixed(2)}</span>
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
                Your registration for <strong>{event.title}</strong> has been confirmed.
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
            {paymentProducts.length > 0 && (
              <>
                <PaymentForm
                  eventId={parseInt(id)}
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
