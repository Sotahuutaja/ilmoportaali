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
          const productsParam = searchParams.get('products');
          const teamParam = searchParams.get('team');
          const commentsParam = searchParams.get('comments');

          if (productsParam) {
            setSelectedProducts(JSON.parse(decodeURIComponent(productsParam)));
          }
          if (teamParam) {
            setTeamId(parseInt(teamParam));
          }
          if (commentsParam) {
            setComments(decodeURIComponent(commentsParam));
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
    // Redirect to success page or back to event
    navigate(`/events/${id}?registered=true`);
  };

  const handlePaymentError = (errorMessage) => {
    setError(errorMessage);
  };

  const handleCancel = () => {
    navigate(`/events/${id}`);
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

  // Calculate total amount
  const totalAmount = paymentProducts.reduce((sum, p) => {
    const product = products.find(prod => prod.id === p.product_id);
    return sum + (parseFloat(product?.price || 0) * p.quantity);
  }, 0);

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto' }}>
      <div className="card">
        <h2>Checkout</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Event: <strong>{event.title}</strong><br />
          📍 {event.location} | 📅 {formatDateTime(event.starts_at)}
        </p>

        {error && <p className="error">{error}</p>}

        {/* Selected Products Summary */}
        <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.1rem' }}>Your Registration</h3>
          {paymentProducts.length > 0 ? (
            <>
              {paymentProducts.map((p, idx) => {
                const product = products.find(prod => prod.id === p.product_id);
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', fontSize: '0.95rem' }}>
                    <span>{product?.name || 'Unknown'} ×{p.quantity}</span>
                    <span>€{(parseFloat(product?.price || 0) * p.quantity).toFixed(2)}</span>
                  </div>
                );
              })}
              {comments && (
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong>Comments:</strong> {comments}
                </div>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>No products selected</p>
          )}
        </div>

        {/* Payment Form */}
        {paymentProducts.length > 0 && (
          <>
            <PaymentForm
              eventId={parseInt(id)}
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
      </div>
    </div>
  );
}
