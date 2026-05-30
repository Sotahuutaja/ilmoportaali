import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import { formatDateTime } from '../utils/datetime';

function ProductSelector({ products, selected, setSelected, onToggle, fieldValues, setFieldValues }) {
  return (
    <div style={{ margin: '1rem 0' }}>
      <label>Products</label>
      {products.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No products for this event.</p>}
      {products.map(p => {
        const isSelected = !!selected[p.id];
        const outOfStock = p.quantity !== null && p.remaining <= 0;
        const fields = p.fields || [];
        return (
          <div key={p.id} style={{ marginBottom: '0.4rem' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.6rem',
              borderRadius: isSelected && fields.length > 0 ? '6px 6px 0 0' : '6px',
              border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
              borderBottom: isSelected && fields.length > 0 ? 'none' : undefined,
              opacity: outOfStock ? 0.5 : 1, cursor: outOfStock ? 'not-allowed' : 'pointer',
              background: isSelected ? 'var(--surface-3)' : 'var(--surface-2)'
            }}
              onClick={() => !outOfStock && onToggle(p.id, setSelected)}
            >
              <div>
                <strong>{p.name}</strong>
                {p.description && <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.9rem' }}>{p.description}</span>}
                {outOfStock && <span style={{ color: '#c0392b', marginLeft: '0.5rem', fontSize: '0.85rem' }}>Sold out</span>}
                {p.quantity !== null && !outOfStock && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>{p.remaining} left</span>
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
            {isSelected && fields.length > 0 && (
              <div style={{
                padding: '0.75rem',
                background: 'var(--surface-3)',
                border: `2px solid var(--accent)`,
                borderTop: 'none',
                borderRadius: '0 0 6px 6px'
              }}
                onClick={e => e.stopPropagation()}
              >
                {fields.map(field => (
                  <div key={field.id} style={{ marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.78rem' }}>
                      {field.label}
                      {field.required && <span style={{ color: '#c0392b', marginLeft: '0.2rem' }}>*</span>}
                    </label>
                    {field.type === 'select' ? (
                      <select
                        value={fieldValues?.[p.id]?.[field.id] || ''}
                        onChange={e => setFieldValues(prev => ({
                          ...prev,
                          [p.id]: { ...(prev[p.id] || {}), [field.id]: e.target.value }
                        }))}
                        style={{ marginBottom: 0 }}
                      >
                        <option value="">Select...</option>
                        {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input
                        value={fieldValues?.[p.id]?.[field.id] || ''}
                        onChange={e => setFieldValues(prev => ({
                          ...prev,
                          [p.id]: { ...(prev[p.id] || {}), [field.id]: e.target.value }
                        }))}
                        placeholder={field.label}
                        style={{ marginBottom: 0 }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RegistrationRow({ r, eventId, onDelete, onUpdate, eventProducts }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState({});
  const [error, setError] = useState('');
  const firstName = r.is_guest ? r.guest_first_name : (r.first_name || '');
  const lastName = r.is_guest ? r.guest_last_name : (r.last_name || '');
  const displayName = lastName && firstName
    ? `${firstName} ${lastName}`
    : firstName || lastName || r.guest_email || r.user_email;

  const startEditing = () => {
    setSelectedProducts(
      r.products
        ? Object.fromEntries(r.products.map(p => [p.product_id, p.quantity]))
        : {}
    );
    setEditing(true);
  };

  const handleSave = async () => {
    setError('');
    const products = Object.entries(selectedProducts)
      .filter(([, qty]) => qty > 0)
      .map(([product_id, quantity]) => ({ product_id: parseInt(product_id), quantity }));

    if (products.length === 0) {
      setError('Please select at least one product.');
      return;
    }

    try {
      await onUpdate(r.id, { products });
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update');
    }
  };


  return (
    <div style={{ marginBottom: '0.2rem' }}>
      <div
        onClick={() => !editing && setOpen(v => !v)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.4rem 0.6rem', borderRadius: open ? '6px 6px 0 0' : '6px',
          background: 'var(--surface-2)', cursor: editing ? 'default' : 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{open ? '▼' : '▶'}</span>
          <span style={{ fontSize: '0.9rem' }}>{displayName}</span>
          {r.is_guest && (
            <span style={{
              fontSize: '0.75rem', padding: '0.1rem 0.4rem',
              borderRadius: '8px', background: '#e67e22', color: 'white'
            }}>guest</span>
          )}
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {r.products ? r.products.length : 0} product{r.products?.length !== 1 ? 's' : ''}
        </span>
      </div>

      {open && (
        <div style={{
          padding: '0.5rem 1rem', background: 'var(--surface-3)',
          borderRadius: '0 0 6px 6px', fontSize: '0.85rem'
        }}>
          {error && <p className="error" style={{ fontSize: '0.85rem' }}>{error}</p>}

          {!editing ? (
            <>
              {r.products && r.products.length > 0 ? (
                r.products.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                    <span>{p.name} x{p.quantity}</span>
                    <span style={{ color: 'var(--text-muted)' }}>€{(parseFloat(p.price) * p.quantity).toFixed(2)}</span>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>No products selected.</p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', borderTop: '1px solid #ddd', paddingTop: '0.5rem' }}>
                <button className="btn btn-secondary" onClick={e => { e.stopPropagation(); startEditing(); }}>
                  Edit products
                </button>
                <button className="btn btn-danger" onClick={e => { e.stopPropagation(); onDelete(r.id, displayName); }}>
                  Delete registration
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Select products:</p>
              {eventProducts.map(p => {
                const isSelected = !!selectedProducts[p.id] && selectedProducts[p.id] > 0;
                return (
                  <div
                    key={p.id}
                    onClick={e => { e.stopPropagation(); setSelectedProducts(prev => ({ ...prev, [p.id]: prev[p.id] > 0 ? 0 : 1 })); }}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.4rem', marginBottom: '0.3rem', borderRadius: '4px',
                      border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--surface-3)' : 'var(--surface-2)', cursor: 'pointer'
                    }}
                  >
                    <span>{p.name} — €{parseFloat(p.price).toFixed(2)}</span>
                    {isSelected && (
                      <input
                        type="number" min="1" value={selectedProducts[p.id]}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setSelectedProducts(prev => ({ ...prev, [p.id]: parseInt(e.target.value) || 1 }))}
                        style={{ width: '50px', margin: 0 }}
                      />
                    )}
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="btn btn-primary" onClick={e => { e.stopPropagation(); handleSave(); }}>Save</button>
                <button className="btn btn-secondary" onClick={e => { e.stopPropagation(); setEditing(false); setError(''); }}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}


export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [products, setProducts] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedProducts, setSelectedProducts] = useState({});
  const [fieldValues, setFieldValues] = useState({});
  const [comments, setComments] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [teamRegistrations, setTeamRegistrations] = useState([]);
  const [isRegistered, setIsRegistered] = useState(false);
  const [allowedTeams, setAllowedTeams] = useState([]);

  // Guest registration state
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestForm, setGuestForm] = useState({ guest_first_name: '', guest_last_name: '', guest_email: '', team_id: '' });
  const [guestProducts, setGuestProducts] = useState({});
  const [guestFieldValues, setGuestFieldValues] = useState({});
  const [guestComments, setGuestComments] = useState('');
  const [captainTeams, setCaptainTeams] = useState([]);

  useEffect(() => {
    api.get(`/events/${id}`).then(res => setEvent(res.data.event));
    api.get(`/events/${id}/products`).then(res => setProducts(res.data.products));
  api.get(`/events/${id}/teams`).then(res => setAllowedTeams(res.data.teams.map(t => t.team_id)));
    if (user) {
      api.get('/teams/my/memberships').then(res => {
        const approved = res.data.teams.filter(t => t.status === 'approved');
        setMyTeams(approved);
        setCaptainTeams(approved.filter(t => t.role === 'captain'));
      });
      // Fetch registrations if user is a captain
      api.get(`/registrations/${id}`)
        .then(res => setTeamRegistrations(res.data.registrations))
        .catch(() => {});
      // Check if user is already registered
      api.get('/registrations/my/list')
        .then(res => {
          const registered = res.data.registrations.some(r => r.id === parseInt(id));
          setIsRegistered(registered);
        })
        .catch(() => {});
    }
  }, [id, user]);

  useEffect(() => {
    if (!event) return;
    if (!event.allow_individual_registration && allowedTeams.length > 0 && myTeams.length > 0) {
      const firstAllowed = myTeams.find(t => allowedTeams.includes(t.id));
      if (firstAllowed) setSelectedTeam(String(firstAllowed.id));
    }
  }, [event, allowedTeams, myTeams]);

  const toggleProduct = (productId, setter) => {
    setter(prev => ({
      ...prev,
      [productId]: prev[productId] ? undefined : 1
    }));
  };

  const buildProducts = (selected, fv = {}) =>
    Object.entries(selected)
      .filter(([, qty]) => qty)
      .map(([product_id, quantity]) => ({
        product_id: parseInt(product_id),
        quantity,
        field_values: fv[product_id] || {}
      }));

  const validateFields = (selected, fv) => {
    for (const [productId, qty] of Object.entries(selected)) {
      if (!qty) continue;
      const product = products.find(p => p.id === parseInt(productId));
      for (const field of (product?.fields || [])) {
        if (field.required && !fv?.[productId]?.[field.id]) {
          return `"${field.label}" is required for ${product.name}`;
        }
      }
    }
    return null;
  };

  const register = async () => {
    setError(''); setMessage('');
    const fieldError = validateFields(selectedProducts, fieldValues);
    if (fieldError) return setError(fieldError);
    const products = buildProducts(selectedProducts, fieldValues);
    if (products.length === 0) {
      return setError('Please select at least one product to register.');
    }
    try {
      await api.post(`/registrations/${id}`, {
        team_id: selectedTeam ? parseInt(selectedTeam) : null,
        products,
        comments
      });
      setMessage('Successfully registered!');
      setIsRegistered(true);
      setEvent(e => ({ ...e, registration_count: e.registration_count + 1 }));
      const regs = await api.get(`/registrations/${id}`).catch(() => null);
      if (regs) setTeamRegistrations(regs.data.registrations);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  const cancel = async () => {
    setError(''); setMessage('');
    try {
      await api.delete(`/registrations/${id}`);
      setMessage('Registration cancelled.');
      setIsRegistered(false);
      setEvent(e => ({ ...e, registration_count: e.registration_count - 1 }));
      const regs = await api.get(`/registrations/${id}`).catch(() => null);
      if (regs) setTeamRegistrations(regs.data.registrations);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel');
    }
  };

  const registerGuest = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    const fieldError = validateFields(guestProducts, guestFieldValues);
    if (fieldError) return setError(fieldError);
    const guestProductList = buildProducts(guestProducts, guestFieldValues);
    if (guestProductList.length === 0) {
      return setError('Please select at least one product for the guest.');
    }
    try {
      await api.post(`/registrations/${id}/guest`, {
        ...guestForm,
        team_id: parseInt(guestForm.team_id),
        products: guestProductList,
        comments: guestComments
      });
      setMessage(`Guest ${guestForm.guest_first_name} registered successfully!`);
      setShowGuestForm(false);
      setGuestForm({ guest_first_name: '', guest_last_name: '', guest_email: '', team_id: '' });
      setGuestProducts({});
      setGuestFieldValues({});
      setGuestComments('');
      setEvent(e => ({ ...e, registration_count: e.registration_count + 1 }));
      const regs = await api.get(`/registrations/${id}`).catch(() => null);
      if (regs) setTeamRegistrations(regs.data.registrations);
    } catch (err) {
      setError(err.response?.data?.error || 'Guest registration failed');
    }
  };
  
  const handleDeleteTeamReg = async (registrationId, name) => {
    if (!window.confirm(`Delete registration for ${name}?`)) return;
    try {
      await api.delete(`/registrations/${id}/registrations/${registrationId}`);
      setTeamRegistrations(teamRegistrations.filter(r => r.id !== registrationId));
      setEvent(e => ({ ...e, registration_count: e.registration_count - 1 }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete registration');
    }
  };

  const handleUpdateTeamReg = async (registrationId, payload) => {
    const res = await api.put(`/registrations/${id}/registrations/${registrationId}`, payload);
    setTeamRegistrations(teamRegistrations.map(r => r.id === registrationId ? res.data.registration : r));
  };

  if (!event) return <p>Loading...</p>;

  const full = event.capacity && event.registration_count >= event.capacity;
  const now = new Date();
  const regNotOpen = event.registration_starts_at && now < new Date(event.registration_starts_at);
  const regClosed = event.registration_ends_at && now > new Date(event.registration_ends_at);
  const registrationOpen = !regNotOpen && !regClosed;

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto' }}>
      <div className="card">
        <h2>{event.title}</h2>
        <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0' }}>
          📍 {event.location}<br />
          📅 {formatDateTime(event.starts_at)} — {formatDateTime(event.ends_at)}
        </p>
        <p style={{ margin: '1rem 0' }}>{event.description}</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          {event.registration_count} registered
          {event.capacity ? ` / ${event.capacity} spots` : ''}
          {full ? ' — FULL' : ''}
        </p>
        {event.registration_starts_at && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            🗓 Ilmoittautumisaika (EET/EEST):{' '}
            {formatDateTime(event.registration_starts_at)} — {formatDateTime(event.registration_ends_at)}
          </p>
        )}

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}

        {user && !full && registrationOpen && (
      <>
      <h3 style={{ marginBottom: '1rem' }}>Register yourself</h3>

      {(() => {
        const canRegisterIndividually = event.allow_individual_registration;
        const hasAllowedTeam = myTeams.filter(t => allowedTeams.includes(t.id)).length > 0;

        if (!canRegisterIndividually && !hasAllowedTeam) {
        return (
          <p style={{ color: '#c0392b' }}>
          Individual registration is not allowed for this event and you are not a member of any allowed team.
          </p>
        );
        }

        return (
        <>
          {hasAllowedTeam && (
          <div>
            <label>Register as part of a team {!canRegisterIndividually ? '(required)' : '(optional)'}</label>
            <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}>
            {canRegisterIndividually && <option value="">No team — register individually</option>}
            {myTeams
              .filter(t => allowedTeams.includes(t.id))
              .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          )}

          <ProductSelector products={products} selected={selectedProducts} setSelected={setSelectedProducts} onToggle={toggleProduct} fieldValues={fieldValues} setFieldValues={setFieldValues} />

          <div style={{ margin: '1rem 0' }}>
            <label>Comments (optional)</label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Any additional information for the organizers..."
              rows={4}
              style={{ marginBottom: 0 }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={register}>Register</button>
          {isRegistered && (
            <button className="btn btn-danger" onClick={cancel}>Cancel registration</button>
          )}
          </div>
        </>
        );
      })()}

            {captainTeams.filter(t => allowedTeams.includes(t.id)).length > 0 && (
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>Register a guest</h3>
                  <button className="btn btn-secondary" onClick={() => setShowGuestForm(v => !v)}>
                    {showGuestForm ? 'Cancel' : 'Add guest'}
                  </button>
                </div>

                {showGuestForm && (
                  <form onSubmit={registerGuest} style={{ marginTop: '1rem' }}>
                    <label>Guest first name</label>
          <input
            value={guestForm.guest_first_name}
            onChange={e => setGuestForm({ ...guestForm, guest_first_name: e.target.value })}
            required
          />
          <label>Guest last name</label>
          <input
            value={guestForm.guest_last_name}
            onChange={e => setGuestForm({ ...guestForm, guest_last_name: e.target.value })}
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
                      {captainTeams.filter(t => allowedTeams.includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>

                    <ProductSelector products={products} selected={guestProducts} setSelected={setGuestProducts} onToggle={toggleProduct} fieldValues={guestFieldValues} setFieldValues={setGuestFieldValues} />

                    <div style={{ margin: '1rem 0' }}>
                      <label>Comments (optional)</label>
                      <textarea
                        value={guestComments}
                        onChange={e => setGuestComments(e.target.value)}
                        placeholder="Any additional information for the organizers..."
                        rows={4}
                        style={{ marginBottom: 0 }}
                      />
                    </div>

                    <button type="submit" className="btn btn-primary">Register guest</button>
                  </form>
                )}
              </div>
            )}
      {captainTeams.filter(t => allowedTeams.includes(t.id)).length > 0 && teamRegistrations.length > 0 && (
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Team registrations</h3>
        {captainTeams.filter(t => allowedTeams.includes(t.id)).map(team => {
          const teamRegs = teamRegistrations
          .filter(r => r.team_id === team.id)
          .sort((a, b) => {
            const nameA = a.is_guest ? (a.guest_first_name || '') : (a.first_name || '');
            const nameB = b.is_guest ? (b.guest_first_name || '') : (b.first_name || '');
            return nameA.localeCompare(nameB, 'fi');
          });
          if (teamRegs.length === 0) return null;
          return (
          <div key={team.id} style={{ marginBottom: '1rem' }}>
            <h4 style={{ marginBottom: '0.5rem', color: '#1a1a2e' }}>
            {team.name} ({teamRegs.length})
            </h4>
            {teamRegs.map(r => (
              <RegistrationRow
              key={r.id}
              r={r}
              eventId={id}
              eventProducts={products}
              onDelete={handleDeleteTeamReg}
              onUpdate={handleUpdateTeamReg}
              />
            ))}
          </div>
          );
        })}
        </div>
      )}
          </>
        )}

        {user && regNotOpen && (
          <p style={{ color: '#e67e22', marginTop: '1rem' }}>
            Registration opens on {formatDateTime(event.registration_starts_at)}.
          </p>
        )}
        {user && regClosed && (
          <p style={{ color: '#c0392b', marginTop: '1rem' }}>Registration is closed.</p>
        )}
        {!user && <p>Please <a href="/login">log in</a> to register for this event.</p>}
      </div>
    </div>
  );
}