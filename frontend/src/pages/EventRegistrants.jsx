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
      ? Object.fromEntries(reg.products.map(p => [p.product_id, { quantity: p.quantity, field_values: p.field_values || {} }]))
      : {}
  );
  const [error, setError] = useState('');
  const [costChangeConfirmed, setCostChangeConfirmed] = useState(false);
  const [costChange, setCostChange] = useState(null);

  // Calculate total cost for products (handles both old and new formats)
  const calculateTotal = (products) => {
    return Object.entries(products).reduce((sum, [productId, item]) => {
      const qty = typeof item === 'number' ? item : (item?.quantity || 0);
      if (qty > 0) {
        const product = eventProducts.find(p => p.id === parseInt(productId));
        if (product) {
          let price = parseFloat(product.price);
          // Check for field option overrides
          if (typeof item === 'object' && item.field_values && product.fields) {
            for (const field of product.fields) {
              if (field.type === 'select' && item.field_values[field.id]) {
                const option = field.options?.find(opt => {
                  const optVal = typeof opt === 'string' ? opt : opt.value;
                  return optVal === item.field_values[field.id];
                });
                if (option && typeof option === 'object' && option.price) {
                  price = parseFloat(option.price);
                  break;
                }
              }
            }
          }
          sum += price * qty;
        }
      }
      return sum;
    }, 0);
  };

  const handleSave = () => {
    const products = Object.entries(selectedProducts)
      .filter(([, item]) => {
        const qty = typeof item === 'number' ? item : (item?.quantity || 0);
        return qty > 0;
      })
      .map(([product_id, item]) => {
        const qty = typeof item === 'number' ? item : (item?.quantity || 0);
        const field_values = typeof item === 'object' ? (item?.field_values || {}) : {};
        return { product_id: parseInt(product_id), quantity: qty, field_values };
      });

    // Calculate old and new totals
    // Use consistent key format (numbers) for comparison
    const originalProductMap = Object.fromEntries(
      (reg.products || []).map(p => [p.product_id, { quantity: p.quantity, field_values: p.field_values || {} }])
    );
    const oldTotal = calculateTotal(originalProductMap);
    const newTotal = calculateTotal(selectedProducts);

    // If costs differ, require confirmation
    if (Math.abs(oldTotal - newTotal) > 0.01 && !costChangeConfirmed) {
      setCostChange({
        oldTotal,
        newTotal,
        difference: newTotal - oldTotal
      });
      return;
    }

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
        {eventProducts.map(p => {
          const isSelected = selectedProducts[p.id]?.quantity > 0 || selectedProducts[p.id] > 0;
          const item = selectedProducts[p.id];
          const quantity = typeof item === 'number' ? item : (item?.quantity || 0);
          const field_values = typeof item === 'object' ? (item?.field_values || {}) : {};

          return (
            <div key={p.id} style={{
              padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '6px',
              border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
              background: isSelected ? 'var(--surface-3)' : 'var(--surface-2)',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer'
              }}
                onClick={() => setSelectedProducts(prev => ({
                  ...prev,
                  [p.id]: prev[p.id] ? 0 : { quantity: 1, field_values: {} }
                }))}
              >
                <div>
                  <strong>{p.name}</strong>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.9rem' }}>€{parseFloat(p.price).toFixed(2)}</span>
                </div>
                {isSelected && (
                  <input
                    type="number" min="1" value={quantity}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setSelectedProducts(prev => ({
                      ...prev,
                      [p.id]: { ...prev[p.id], quantity: parseInt(e.target.value) }
                    }))}
                    style={{ width: '60px', margin: 0 }}
                  />
                )}
              </div>

              {/* Product fields/options */}
              {isSelected && p.fields && p.fields.length > 0 && (
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                  {p.fields.map(field => (
                    field.type === 'select' && (
                      <div key={field.id} style={{ marginBottom: '0.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                          <strong>{field.label}</strong>
                        </label>
                        <select
                          value={field_values[field.id] || ''}
                          onChange={e => setSelectedProducts(prev => ({
                            ...prev,
                            [p.id]: { ...prev[p.id], field_values: { ...field_values, [field.id]: e.target.value } }
                          }))}
                          style={{ width: '100%', padding: '0.4rem' }}
                        >
                          <option value="">Select {field.label.toLowerCase()}</option>
                          {field.options?.map(opt => {
                            const optVal = typeof opt === 'string' ? opt : opt.value;
                            const optLabel = typeof opt === 'string' ? opt : opt.label || opt.value;
                            return <option key={optVal} value={optVal}>{optLabel}</option>;
                          })}
                        </select>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {costChange && (
          <div style={{ background: costChange.difference < 0 ? '#d4edda' : '#fff3cd', padding: '1rem', borderRadius: '6px', marginTop: '1rem', borderLeft: `4px solid ${costChange.difference < 0 ? '#28a745' : '#ffc107'}` }}>
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: costChange.difference < 0 ? '#155724' : '#856404' }}>
              {costChange.difference < 0 ? '✓ Refund will be issued' : '⚠️ Additional payment required'}
            </p>
            <p style={{ margin: '0.3rem 0', fontSize: '0.9rem', color: costChange.difference < 0 ? '#155724' : '#856404' }}>
              Old total: <strong>€{costChange.oldTotal.toFixed(2)}</strong>
            </p>
            <p style={{ margin: '0.3rem 0', fontSize: '0.9rem', color: costChange.difference < 0 ? '#155724' : '#856404' }}>
              New total: <strong>€{costChange.newTotal.toFixed(2)}</strong>
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: costChange.difference < 0 ? '#155724' : '#856404' }}>
              {costChange.difference < 0 ? 'Refund amount:' : 'Additional payment:'} <strong>{costChange.difference > 0 ? '+' : ''}€{Math.abs(costChange.difference).toFixed(2)}</strong>
            </p>
            <p style={{ margin: '0.8rem 0 0 0', fontSize: '0.85rem', color: costChange.difference < 0 ? '#155724' : '#856404' }}>
              {costChange.difference < 0
                ? '✓ A refund will be automatically processed to the original payment method.'
                : '⚠️ User will receive an email with a link to pay the additional amount.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setCostChangeConfirmed(true);
                  // Trigger save in next render
                  setTimeout(() => {
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
                  }, 0);
                }}
                style={{ flex: 1 }}
              >
                Confirm & Save
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setCostChange(null)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!costChange && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1 }}>Save changes</button>
            <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          </div>
        )}
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
    if (!user) {
      navigate('/');
      return;
    }

    // Load event details
    api.get(`/events/${id}`)
      .then(res => setEvent(res.data.event))
      .catch(() => setError('Failed to load event'));

    // Load registrations (backend will validate access for creator, co-manager, admin, or captain)
    api.get(`/registrations/${id}`)
      .then(res => setRegistrations(res.data.registrations))
      .catch(err => {
        if (err.response?.status === 403) {
          setError('Not authorized to view registrations');
          navigate('/');
        } else {
          setError('Failed to load registrations');
        }
      });

    api.get('/teams')
      .then(res => setTeams(res.data.teams));
    api.get(`/events/${id}/products`)
      .then(res => setEventProducts(res.data.products));
  }, [id, user, navigate]);

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
  const headers = ['First name', 'Last name', 'Email', 'Team', 'Products', 'Total price', 'Payment Status', 'Type', 'Registered', 'Comments'];
  const rows = registrations.map(r => {
    const firstName = r.is_guest ? r.guest_first_name : (r.first_name || '');
    const lastName = r.is_guest ? r.guest_last_name : (r.last_name || '');
    const email = r.email_for_export || (r.is_guest ? r.guest_email : r.user_email);
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
    const paymentStatus = r.payment_status ? r.payment_status.charAt(0).toUpperCase() + r.payment_status.slice(1) : 'Unknown';
    const type = r.is_guest ? 'Guest' : 'Registered user';
    const registered = formatDateTime(r.created_at, {
      day: 'numeric', month: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const comments = r.comments || '';
    return [firstName, lastName, email, team, products, totalPrice, paymentStatus, type, registered, comments];
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
      ? `${r.guest_first_name || ''} ${r.guest_last_name || ''}`.trim()
      : `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.user_email;
    const email = r.email_for_export || (r.is_guest ? r.guest_email : r.user_email);
    const term = search.toLowerCase();
    return (
      name?.toLowerCase().includes(term) ||
      email?.toLowerCase().includes(term) ||
      r.team_name?.toLowerCase().includes(term)
    );
  });

  const totalRevenue = registrations.reduce((sum, r) => {
    if (!r.products) return sum;
    return sum + r.products.reduce((s, p) => s + (parseFloat(p.price) * p.quantity), 0);
  }, 0);

  if (!event) return <p>Loading...</p>;

  return (
    <div style={{
      width: '100vw',
      marginLeft: 'calc(-50vw + 50%)',
      marginRight: 'calc(-50vw + 50%)',
      paddingLeft: 0,
      paddingRight: 0,
      position: 'relative'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginLeft: '1rem', marginRight: '1rem', marginTop: '1.5rem', marginBottom: '1rem' }}>
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

      {error && <p className="error" style={{ marginLeft: '1rem', marginRight: '1rem' }}>{error}</p>}
      {message && <p className="success" style={{ marginLeft: '1rem', marginRight: '1rem' }}>{message}</p>}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
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

      <div style={{ marginBottom: '1rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <input
          placeholder="Search by name, email or team..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 0, width: '100%' }}
        />
      </div>

      <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem', marginBottom: '1rem', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>First name</th>
        <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Last name</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Team</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Products</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Payment Status</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Registered</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const name = r.is_guest
                ? `${r.guest_first_name || ''} ${r.guest_last_name || ''}`.trim()
                : `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.user_email;
              const email = r.email_for_export || (r.is_guest ? r.guest_email : r.user_email);
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
          <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.9rem' }}>
            {r.is_guest ? (r.guest_last_name || '') : (r.last_name || '—')}
          </td>
                  <td style={{ padding: '0.6rem 0.8rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{email}</td>
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
                            <div key={i} style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                              <span>{p.name} x{p.quantity} — €{(parseFloat(p.price) * p.quantity).toFixed(2)}</span>
                              {fieldParts.map(({ label, val }) => (
                                <span key={label} style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', paddingLeft: '0.5rem' }}>
                                  {label}: {val}
                                </span>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>
                    )}
                  </td>
                  <td style={{ padding: '0.8rem 1rem' }}>
                    <span style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      background: r.payment_status === 'paid' ? '#d4edda' : r.payment_status === 'pending' ? '#fff3cd' : '#f8d7da',
                      color: r.payment_status === 'paid' ? '#155724' : r.payment_status === 'pending' ? '#856404' : '#721c24'
                    }}>
                      {r.payment_status ? r.payment_status.charAt(0).toUpperCase() + r.payment_status.slice(1) : 'Unknown'}
                    </span>
                  </td>
                  <td style={{ padding: '0.8rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {formatDateTime(r.created_at, {
                      day: 'numeric', month: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </td>
                  <td style={{ padding: '0.6rem 0.8rem' }}>
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