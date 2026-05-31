import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import { fullName } from '../AuthContext';
import { formatDate, formatDateTime } from '../utils/datetime';

function EditRegistrantModal({ reg, teams, eventProducts, onClose, onSave }) {
  const [form, setForm] = useState({
    first_name: reg.first_name || '',
    last_name: reg.last_name || '',
    email: reg.is_guest ? reg.guest_email : reg.user_email,
    guest_first_name: reg.guest_first_name || '',
    guest_last_name: reg.guest_last_name || '',
    team_id: reg.team_id || ''
  });
  const [selectedProducts, setSelectedProducts] = useState(
    reg.products
      ? Object.fromEntries(reg.products.map(p => [p.product_id, p.quantity]))
      : {}
  );
  const [error, setError] = useState('');

  const handleSave = () => {
    const products = Object.entries(selectedProducts)
      .filter(([, qty]) => qty > 0)
      .map(([product_id, quantity]) => ({ product_id: parseInt(product_id), quantity }));

    const payload = {
      team_id: form.team_id ? parseInt(form.team_id) : null,
      products
    };

    if (reg.is_guest) {
    payload.guest_first_name = form.guest_first_name;
    payload.guest_last_name = form.guest_last_name;
    payload.guest_email = form.email;
  } else {
      payload.first_name = form.first_name;
      payload.last_name = form.last_name;
      payload.email = form.email;
    }

    onSave(reg.id, payload);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }}>
      <div className="card" style={{ width: 500, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>
          Edit registration {reg.is_guest && <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '8px', background: '#e67e22', color: 'white', marginLeft: '0.5rem' }}>guest</span>}
        </h3>
        {error && <p className="error">{error}</p>}

        {reg.is_guest ? (
          <>
            <label>Guest first name</label>
      <input value={form.guest_first_name} onChange={e => setForm({ ...form, guest_first_name: e.target.value })} />
      <label>Guest last name</label>
      <input value={form.guest_last_name} onChange={e => setForm({ ...form, guest_last_name: e.target.value })} />
            <label>Guest email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </>
        ) : (
          <>
            <label>First name</label>
            <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
            <label>Last name</label>
            <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </>
        )}

        <label>Team</label>
        <select value={form.team_id} onChange={e => setForm({ ...form, team_id: e.target.value })}>
          <option value="">No team — individual</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <label style={{ marginBottom: '0.5rem', display: 'block' }}>Products</label>
        {eventProducts.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No products for this event.</p>}
        {eventProducts.map(p => (
          <div key={p.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.5rem', marginBottom: '0.3rem', borderRadius: '6px',
            border: `2px solid ${selectedProducts[p.id] ? 'var(--accent)' : 'var(--border)'}`,
            background: selectedProducts[p.id] ? 'var(--surface-3)' : 'var(--surface-2)',
            cursor: 'pointer'
          }}
            onClick={() => setSelectedProducts(prev => ({
              ...prev,
              [p.id]: prev[p.id] ? 0 : 1
            }))}
          >
            <div>
              <strong>{p.name}</strong>
              <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.9rem' }}>€{parseFloat(p.price).toFixed(2)}</span>
            </div>
            {selectedProducts[p.id] > 0 && (
              <input
                type="number" min="1" value={selectedProducts[p.id]}
                onClick={e => e.stopPropagation()}
                onChange={e => setSelectedProducts(prev => ({ ...prev, [p.id]: parseInt(e.target.value) }))}
                style={{ width: '60px', margin: 0 }}
              />
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1 }}>Save changes</button>
          <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function EventRegistrants() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [editingReg, setEditingReg] = useState(null);
  const [teams, setTeams] = useState([]);
  const [eventProducts, setEventProducts] = useState([]);

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
  api.get('/teams')
    .then(res => setTeams(res.data.teams));
  api.get(`/events/${id}/products`)
    .then(res => setEventProducts(res.data.products));
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
  
  const handleSaveReg = async (registrationId, payload) => {
    try {
      const res = await api.put(`/registrations/${id}/registrations/${registrationId}`, payload);
      setRegistrations(registrations.map(r => r.id === registrationId ? res.data.registration : r));
      setEditingReg(null);
      setMessage('Registration updated.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update registration');
    }
  };
  
  const exportRegistrantsCSV = () => {
  const headers = ['First name', 'Last name', 'Email', 'Team', 'Products', 'Total price', 'Type', 'Registered', 'Comments'];
  const rows = registrations.map(r => {
    const firstName = r.is_guest ? r.guest_first_name : (r.first_name || '');
    const lastName = r.is_guest ? r.guest_last_name : (r.last_name || '');
    const email = r.is_guest ? r.guest_email : r.user_email;
    const team = r.team_name || '';
    const products = r.products
      ? r.products.map(p => {
          const fieldParts = Object.entries(p.field_values || {}).map(([fid, val]) => {
            const fieldDef = (p.fields || []).find(f => f.id === fid);
            return `${fieldDef?.label || fid}: ${val}`;
          });
          return `${p.name} x${p.quantity}${fieldParts.length ? ` (${fieldParts.join(', ')})` : ''}`;
        }).join('; ')
      : '';
    const totalPrice = r.products
      ? r.products.reduce((sum, p) => sum + parseFloat(p.price) * p.quantity, 0).toFixed(2)
      : '0.00';
    const type = r.is_guest ? 'Guest' : 'Registered user';
    const registered = formatDateTime(r.created_at, {
      day: 'numeric', month: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const comments = r.comments || '';
    return [firstName, lastName, email, team, products, totalPrice, type, registered, comments];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `registrants-${event.title.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  };

  const filtered = registrations.filter(r => {
    const name = r.is_guest
      ? `${r.guest_first_name || ''} ${r.guest_last_name || ''}`.trim() || r.guest_email
      : `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.user_email;
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
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            📍 {event.location} &nbsp;|&nbsp;
            📅 {formatDate(event.starts_at)}
          </p>
        </div>
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <button className="btn btn-secondary" onClick={exportRegistrantsCSV}>
      Export CSV
      </button>
      <Link to="/dashboard">
      <button className="btn btn-secondary">Back to dashboard</button>
      </Link>
    </div>
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total participants</p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>{registrations.length}</p>
          {event.capacity && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>of {event.capacity} capacity</p>
          )}
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Guest participants</p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>
            {registrations.filter(r => r.is_guest).length}
          </p>
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total product revenue</p>
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

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
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
              const name = r.is_guest
                ? `${r.guest_first_name || ''} ${r.guest_last_name || ''}`.trim() || r.guest_email
                : `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.user_email;
              const email = r.is_guest ? r.guest_email : r.user_email;
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.8rem 1rem' }}>
            {r.is_guest ? (r.guest_first_name || r.guest_name || '—') : (r.first_name || '—')}
            {r.is_guest && (
            <span style={{
              marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.1rem 0.4rem',
              borderRadius: '8px', background: '#e67e22', color: 'white'
            }}>guest</span>
            )}
          </td>
          <td style={{ padding: '0.8rem 1rem' }}>
            {r.is_guest ? (r.guest_last_name || '') : (r.last_name || '—')}
          </td>
                  <td style={{ padding: '0.8rem 1rem', color: 'var(--text-muted)' }}>{email}</td>
                  <td style={{ padding: '0.8rem 1rem' }}>
                    {r.team_name ? (
                      <span style={{
                        padding: '0.2rem 0.6rem', borderRadius: '12px',
                        background: '#1a1a2e', color: 'white', fontSize: '0.85rem'
                      }}>{r.team_name}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Individual</span>
                    )}
                  </td>
                  <td style={{ padding: '0.8rem 1rem' }}>
                    {r.products && r.products.length > 0 ? (
                      <div>
                        {r.products.map((p, i) => {
                          const fieldParts = Object.entries(p.field_values || {}).map(([fid, val]) => {
                            const fieldDef = (p.fields || []).find(f => f.id === fid);
                            return { label: fieldDef?.label || fid, val };
                          });
                          return (
                            <div key={i} style={{ fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                              <span>{p.name} x{p.quantity} — €{(parseFloat(p.price) * p.quantity).toFixed(2)}</span>
                              {fieldParts.map(({ label, val }) => (
                                <span key={label} style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', paddingLeft: '0.5rem' }}>
                                  {label}: {val}
                                </span>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None</span>
                    )}
                  </td>
                  <td style={{ padding: '0.8rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {formatDateTime(r.created_at, {
                      day: 'numeric', month: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </td>
                  <td style={{ padding: '0.8rem 1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setEditingReg(r)}>Edit</button>
            <button className="btn btn-danger" onClick={() => handleCancel(r.id, name)}>Cancel</button>
            </div>
          </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No participants found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
  {editingReg && (
    <EditRegistrantModal
    reg={editingReg}
    teams={teams}
    eventProducts={eventProducts}
    onClose={() => setEditingReg(null)}
    onSave={handleSaveReg}
    />
  )}
    </div>
  );
}