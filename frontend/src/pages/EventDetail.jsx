import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [products, setProducts] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedProducts, setSelectedProducts] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Guest registration state
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestForm, setGuestForm] = useState({ guest_name: '', guest_email: '', team_id: '' });
  const [guestProducts, setGuestProducts] = useState({});
  const [captainTeams, setCaptainTeams] = useState([]);

  useEffect(() => {
    api.get(`/events/${id}`).then(res => setEvent(res.data.event));
    api.get(`/events/${id}/products`).then(res => setProducts(res.data.products));
    if (user) {
      api.get('/teams/my/memberships').then(res => {
        const approved = res.data.teams.filter(t => t.status === 'approved');
        setMyTeams(approved);
        setCaptainTeams(approved.filter(t => t.role === 'captain'));
      });
    }
  }, [id, user]);

  const toggleProduct = (productId, setter) => {
    setter(prev => ({
      ...prev,
      [productId]: prev[productId] ? undefined : 1
    }));
  };

  const buildProducts = (selected) =>
    Object.entries(selected)
      .filter(([, qty]) => qty)
      .map(([product_id, quantity]) => ({ product_id: parseInt(product_id), quantity }));

  const register = async () => {
    setError(''); setMessage('');
    try {
      await api.post(`/registrations/${id}`, {
        team_id: selectedTeam ? parseInt(selectedTeam) : null,
        products: buildProducts(selectedProducts)
      });
      setMessage('Successfully registered!');
      setEvent(e => ({ ...e, registration_count: e.registration_count + 1 }));
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  const cancel = async () => {
    setError(''); setMessage('');
    try {
      await api.delete(`/registrations/${id}`);
      setMessage('Registration cancelled.');
      setEvent(e => ({ ...e, registration_count: e.registration_count - 1 }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel');
    }
  };

  const registerGuest = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      await api.post(`/registrations/${id}/guest`, {
        ...guestForm,
        team_id: parseInt(guestForm.team_id),
        products: buildProducts(guestProducts)
      });
      setMessage(`Guest ${guestForm.guest_name} registered successfully!`);
      setShowGuestForm(false);
      setGuestForm({ guest_name: '', guest_email: '', team_id: '' });
      setGuestProducts({});
      setEvent(e => ({ ...e, registration_count: e.registration_count + 1 }));
    } catch (err) {
      setError(err.response?.data?.error || 'Guest registration failed');
    }
  };

  if (!event) return <p>Loading...</p>;

  const full = event.capacity && event.registration_count >= event.capacity;

  const ProductSelector = ({ selected, setSelected }) => (
    <div style={{ margin: '1rem 0' }}>
      <label>Products</label>
      {products.length === 0 && <p style={{ color: '#888', fontSize: '0.9rem' }}>No products for this event.</p>}
      {products.map(p => {
        const isSelected = !!selected[p.id];
        const outOfStock = p.quantity !== null && p.remaining <= 0;
        return (
          <div key={p.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.6rem', marginBottom: '0.4rem', borderRadius: '6px',
            border: `2px solid ${isSelected ? '#1a1a2e' : '#eee'}`,
            opacity: outOfStock ? 0.5 : 1, cursor: outOfStock ? 'not-allowed' : 'pointer',
            background: isSelected ? '#f0f0f8' : 'white'
          }}
            onClick={() => !outOfStock && toggleProduct(p.id, setSelected)}
          >
            <div>
              <strong>{p.name}</strong>
              {p.description && <span style={{ color: '#666', marginLeft: '0.5rem', fontSize: '0.9rem' }}>{p.description}</span>}
              {outOfStock && <span style={{ color: '#c0392b', marginLeft: '0.5rem', fontSize: '0.85rem' }}>Sold out</span>}
              {p.quantity !== null && !outOfStock && (
                <span style={{ color: '#888', marginLeft: '0.5rem', fontSize: '0.85rem' }}>{p.remaining} left</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <strong>€{parseFloat(p.price).toFixed(2)}</strong>
              {isSelected && (
                <input
                  type="number" min="1"
                  max={p.quantity !== null ? p.remaining : undefined}
                  value={selected[p.id]}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setSelected(prev => ({ ...prev, [p.id]: parseInt(e.target.value) }))}
                  style={{ width: '60px', margin: 0 }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto' }}>
      <div className="card">
        <h2>{event.title}</h2>
        <p style={{ color: '#666', margin: '0.5rem 0' }}>
          📍 {event.location}<br />
          📅 {new Date(event.starts_at).toLocaleString('fi-FI')} —{' '}
          {new Date(event.ends_at).toLocaleString('fi-FI')}
        </p>
        <p style={{ margin: '1rem 0' }}>{event.description}</p>
        <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1rem' }}>
          {event.registration_count} registered
          {event.capacity ? ` / ${event.capacity} spots` : ''}
          {full ? ' — FULL' : ''}
        </p>

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}

        {user && !full && (
          <>
            <h3 style={{ marginBottom: '1rem' }}>Register yourself</h3>

            {myTeams.length > 0 && (
              <div>
                <label>Register as part of a team (optional)</label>
                <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}>
                  <option value="">No team — register individually</option>
                  {myTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            <ProductSelector selected={selectedProducts} setSelected={setSelectedProducts} />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={register}>Register</button>
              <button className="btn btn-danger" onClick={cancel}>Cancel registration</button>
            </div>

            {captainTeams.length > 0 && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>Register a guest</h3>
                  <button className="btn btn-secondary" onClick={() => setShowGuestForm(v => !v)}>
                    {showGuestForm ? 'Cancel' : 'Add guest'}
                  </button>
                </div>

                {showGuestForm && (
                  <form onSubmit={registerGuest} style={{ marginTop: '1rem' }}>
                    <label>Guest name</label>
                    <input
                      value={guestForm.guest_name}
                      onChange={e => setGuestForm({ ...guestForm, guest_name: e.target.value })}
                      required
                    />
                    <label>Guest email</label>
                    <input
                      type="email"
                      value={guestForm.guest_email}
                      onChange={e => setGuestForm({ ...guestForm, guest_email: e.target.value })}
                      required
                    />
                    <label>Team</label>
                    <select
                      value={guestForm.team_id}
                      onChange={e => setGuestForm({ ...guestForm, team_id: e.target.value })}
                      required
                    >
                      <option value="">Select team...</option>
                      {captainTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>

                    <ProductSelector selected={guestProducts} setSelected={setGuestProducts} />

                    <button type="submit" className="btn btn-primary">Register guest</button>
                  </form>
                )}
              </div>
            )}
          </>
        )}

        {!user && <p>Please <a href="/login">log in</a> to register for this event.</p>}
      </div>
    </div>
  );
}