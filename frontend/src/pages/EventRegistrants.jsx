import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import { fullName } from '../AuthContext';

export default function EventRegistrants() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'creator')) {
      navigate('/');
      return;
    }
    api.get(`/events/${id}`)
      .then(res => setEvent(res.data.event))
      .catch(() => setError('Failed to load event'));
    api.get(`/registrations/${id}`)
      .then(res => setRegistrations(res.data.registrations))
      .catch(() => setError('Failed to load registrations'));
  }, [id, user]);

  const handleCancel = async (registrationId, name) => {
    if (!window.confirm(`Cancel registration for ${name}?`)) return;
    try {
      await api.delete(`/registrations/${id}/registrations/${registrationId}`);
      setRegistrations(registrations.filter(r => r.id !== registrationId));
      setMessage(`Registration for ${name} cancelled.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel registration');
    }
  };

  const filtered = registrations.filter(r => {
    const name = r.is_guest
      ? r.guest_name
      : fullName({ first_name: r.first_name, last_name: r.last_name, email: r.user_email });
    const term = search.toLowerCase();
    return (
      name?.toLowerCase().includes(term) ||
      r.user_email?.toLowerCase().includes(term) ||
      r.guest_email?.toLowerCase().includes(term) ||
      r.team_name?.toLowerCase().includes(term)
    );
  });

  const totalRevenue = registrations.reduce((sum, r) => {
    if (!r.products) return sum;
    return sum + r.products.reduce((s, p) => s + (parseFloat(p.price) * p.quantity), 0);
  }, 0);

  if (!event) return <p>Loading...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.5rem 0' }}>
        <div>
          <h2>{event.title}</h2>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            📍 {event.location} &nbsp;|&nbsp;
            📅 {new Date(event.starts_at).toLocaleDateString('fi-FI')}
          </p>
        </div>
        <Link to="/dashboard">
          <button className="btn btn-secondary">Back to dashboard</button>
        </Link>
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>Total registrations</p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{registrations.length}</p>
          {event.capacity && (
            <p style={{ color: '#888', fontSize: '0.85rem' }}>of {event.capacity} capacity</p>
          )}
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>Guest registrations</p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>
            {registrations.filter(r => r.is_guest).length}
          </p>
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>Total product revenue</p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>€{totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <input
          placeholder="Search by name, email or team..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 0 }}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9f9f9', borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>First name</th>
			  <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Last name</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Team</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Products</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Registered</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const name = r.is_guest ? r.guest_name : r.user_name;
              const email = r.is_guest ? r.guest_email : r.user_email;
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '0.8rem 1rem' }}>
				    {r.is_guest ? r.guest_name : (r.first_name || '—')}
				    {r.is_guest && (
					  <span style={{
					    marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.1rem 0.4rem',
					    borderRadius: '8px', background: '#e67e22', color: 'white'
					  }}>guest</span>
				    )}
				  </td>
				  <td style={{ padding: '0.8rem 1rem' }}>
				    {r.is_guest ? '' : (r.last_name || '—')}
				  </td>
                  <td style={{ padding: '0.8rem 1rem', color: '#666' }}>{email}</td>
                  <td style={{ padding: '0.8rem 1rem' }}>
                    {r.team_name ? (
                      <span style={{
                        padding: '0.2rem 0.6rem', borderRadius: '12px',
                        background: '#1a1a2e', color: 'white', fontSize: '0.85rem'
                      }}>{r.team_name}</span>
                    ) : (
                      <span style={{ color: '#aaa', fontSize: '0.85rem' }}>Individual</span>
                    )}
                  </td>
                  <td style={{ padding: '0.8rem 1rem' }}>
                    {r.products && r.products.length > 0 ? (
                      <div>
                        {r.products.map((p, i) => (
                          <div key={i} style={{ fontSize: '0.85rem', color: '#444' }}>
                            {p.name} x{p.quantity} — €{(parseFloat(p.price) * p.quantity).toFixed(2)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#aaa', fontSize: '0.85rem' }}>None</span>
                    )}
                  </td>
                  <td style={{ padding: '0.8rem 1rem', color: '#888', fontSize: '0.85rem' }}>
                    {new Date(r.created_at).toLocaleDateString('fi-FI')}
                  </td>
                  <td style={{ padding: '0.8rem 1rem' }}>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleCancel(r.id, name)}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                  No registrations found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}