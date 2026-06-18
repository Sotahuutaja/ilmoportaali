import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import { formatDateTime } from '../utils/datetime';
import RegistrationReview from '../components/RegistrationReview';

function ProductSelector({ products, selected, setSelected, onToggle, fieldValues, setFieldValues }) {
  // Calculate effective price based on selected dropdown options
  const getEffectivePrice = (product) => {
    let price = parseFloat(product.price);
    const productFields = product.fields || [];

    for (const field of productFields) {
      if (field.type === 'select') {
        const selectedValue = fieldValues?.[product.id]?.[field.id];
        if (selectedValue) {
          const option = field.options.find(opt =>
            (typeof opt === 'string' ? opt : opt.value) === selectedValue
          );
          if (option && typeof option === 'object' && option.price !== null && option.price !== undefined) {
            price = parseFloat(option.price);
          }
        }
      }
    }
    return price;
  };

  return (
    <div style={{ margin: '1rem 0' }}>
      <label>Products</label>
      {products.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No products for this event.</p>}
      {products.map(p => {
        const isSelected = !!selected[p.id];
        const outOfStock = p.quantity !== null && p.remaining <= 0;
        const fields = p.fields || [];
        const effectivePrice = getEffectivePrice(p);
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
                <strong>€{effectivePrice.toFixed(2)}</strong>
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
                      {(field.type === 'select' || field.required) && <span style={{ color: '#c0392b', marginLeft: '0.2rem' }}>*</span>}
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
                        {field.options.map((opt, idx) => {
                          const optValue = typeof opt === 'string' ? opt : opt.value;
                          const optPrice = typeof opt === 'string' ? null : opt.price;
                          const optRemaining = typeof opt === 'string' ? null : (opt.remaining !== undefined ? opt.remaining : opt.quantity);
                          const isOutOfStock = optRemaining !== null && optRemaining !== undefined && optRemaining <= 0;
                          let optionLabel = optValue;
                          // Show option-specific price or default product price
                          const displayPrice = optPrice !== null && optPrice !== undefined ? optPrice : p.price;
                          optionLabel += ` — €${parseFloat(displayPrice).toFixed(2)}`;
                          if (optRemaining !== null && optRemaining !== undefined) {
                            if (isOutOfStock) {
                              optionLabel += ` (out of stock)`;
                            } else {
                              optionLabel += ` (${optRemaining} available)`;
                            }
                          }
                          return <option key={idx} value={optValue} disabled={isOutOfStock}>{optionLabel}</option>;
                        })}
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

function RegistrationRow({ r, eventId, onDelete, onUpdate, eventProducts, isEventPast }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const firstName = r.is_guest ? r.guest_first_name : (r.first_name || '');
  const lastName = r.is_guest ? r.guest_last_name : (r.last_name || '');
  const displayName = lastName && firstName
    ? `${firstName} ${lastName}`
    : firstName || lastName || r.user_email;



  return (
    <div style={{ marginBottom: '0.2rem' }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.4rem 0.6rem', borderRadius: open ? '6px 6px 0 0' : '6px',
          background: 'var(--surface-2)', cursor: 'pointer',
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
          {!isEventPast && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', borderTop: '1px solid #ddd', paddingTop: '0.5rem' }}>
              <button className="btn btn-danger" onClick={e => { e.stopPropagation(); onDelete(r.id, displayName); }}>
                Delete registration
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
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
  const [showReview, setShowReview] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState(null);

  // Guest registration state
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestForm, setGuestForm] = useState({
    guest_first_name: '',
    guest_last_name: '',
    year_of_birth: new Date().getFullYear() - 18,
    gender: '',
    team_id: ''
  });
  const [guestProducts, setGuestProducts] = useState({});
  const [guestFieldValues, setGuestFieldValues] = useState({});
  const [guestComments, setGuestComments] = useState('');
  const [captainTeams, setCaptainTeams] = useState([]);
  const [pendingGuests, setPendingGuests] = useState([]);
  const reviewRef = useRef(null);

  // Auto-scroll to review section when it appears
  useEffect(() => {
    if (showReview && reviewRef.current) {
      setTimeout(() => {
        reviewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [showReview]);

  useEffect(() => {
    api.get(`/events/${id}`).then(res => setEvent(res.data.event));
    api.get(`/events/${id}/products`).then(res => setProducts(res.data.products));
  api.get(`/events/${id}/teams`).then(res => setAllowedTeams(res.data.teams));
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
      const allowedTeamIds = allowedTeams.map(t => t.team_id);
      const firstAllowed = myTeams.find(t => allowedTeamIds.includes(t.id));
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
        // Dropdown/select fields are mandatory by default
        // Other fields are only mandatory if explicitly marked as required
        const isMandatory = field.type === 'select' || field.required;
        if (isMandatory && !fv?.[productId]?.[field.id]) {
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
    const productsToRegister = buildProducts(selectedProducts, fieldValues);
    if (productsToRegister.length === 0 && pendingGuests.length === 0) {
      return setError('Please select at least one product or add guests.');
    }

    // Helper to calculate price with field option overrides
    const getProductPriceWithOptions = (productId, fieldVals) => {
      const eventProduct = products.find(ep => ep.id === productId);
      let price = parseFloat(eventProduct?.price || 0);
      const productFields = eventProduct?.fields || [];

      if (fieldVals && productFields.length > 0) {
        for (const field of productFields) {
          if (field.type === 'select') {
            const selectedValue = fieldVals[field.id];
            if (selectedValue) {
              const option = field.options.find(opt =>
                (typeof opt === 'string' ? opt : opt.value) === selectedValue
              );
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

    // Build product details with names and prices from the event products list
    const productDetails = productsToRegister.map(p => {
      const eventProduct = products.find(ep => ep.id === p.product_id);
      const price = getProductPriceWithOptions(p.product_id, p.field_values);
      return {
        product_id: p.product_id,
        quantity: p.quantity,
        field_values: p.field_values,
        name: eventProduct?.name || 'Unknown',
        price: price
      };
    });

    // Calculate total for captain
    const captainTotal = productDetails.reduce((sum, p) => sum + (p.price * p.quantity), 0);

    // Calculate total for all guests
    const guestsTotal = pendingGuests.reduce((sum, guest) => {
      const guestTotal = guest.products.reduce((s, p) => s + (p.price * p.quantity), 0);
      return sum + guestTotal;
    }, 0);

    // Grand total
    const totalAmount = captainTotal + guestsTotal;

    // Get team name
    const teamName = selectedTeam ? myTeams.find(t => t.id === parseInt(selectedTeam))?.name : null;

    // Store and show review
    setPendingRegistration({
      captain: {
        products: productDetails,
        teamId: selectedTeam ? parseInt(selectedTeam) : null,
        teamName,
        comments
      },
      guests: pendingGuests,
      totalAmount
    });
    setShowReview(true);
  };

  const handleReviewConfirm = () => {
    // Redirect to checkout with captain + guests data
    const checkoutParams = new URLSearchParams({
      registrations: JSON.stringify({
        captain: pendingRegistration.captain,
        guests: pendingRegistration.guests
      })
    });

    navigate(`/events/${id}/checkout?${checkoutParams.toString()}`);
  };

  const handleReviewCancel = () => {
    setShowReview(false);
    setPendingRegistration(null);
  };

  const cancel = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel your registration?\n\n' +
      'Your full registration fee will be refunded to your original payment method.\n\n' +
      'This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    setError(''); setMessage('');
    try {
      await api.delete(`/registrations/${id}`);
      setMessage('Registration cancelled. You will receive a refund shortly.');
      setIsRegistered(false);
      setEvent(e => ({ ...e, registration_count: e.registration_count - 1 }));
      const regs = await api.get(`/registrations/${id}`).catch(() => null);
      if (regs) setTeamRegistrations(regs.data.registrations);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel');
    }
  };

  const registerGuest = (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    const fieldError = validateFields(guestProducts, guestFieldValues);
    if (fieldError) return setError(fieldError);
    const guestProductList = buildProducts(guestProducts, guestFieldValues);
    if (guestProductList.length === 0) {
      return setError('Please select at least one product for the guest.');
    }

    // Helper to calculate price with field option overrides
    const getGuestProductPrice = (productId, fieldVals) => {
      const eventProduct = products.find(ep => ep.id === productId);
      let price = parseFloat(eventProduct?.price || 0);
      const productFields = eventProduct?.fields || [];

      if (fieldVals && productFields.length > 0) {
        for (const field of productFields) {
          if (field.type === 'select') {
            const selectedValue = fieldVals[field.id];
            if (selectedValue) {
              const option = field.options.find(opt =>
                (typeof opt === 'string' ? opt : opt.value) === selectedValue
              );
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

    // Build guest product details with option price overrides
    const guestProductDetails = guestProductList.map(p => {
      const eventProduct = products.find(ep => ep.id === p.product_id);
      const price = getGuestProductPrice(p.product_id, p.field_values);
      return {
        product_id: p.product_id,
        quantity: p.quantity,
        field_values: p.field_values,
        name: eventProduct?.name || 'Unknown',
        price: price
      };
    });

    // Add guest to pending guests (not to backend yet)
    const newGuest = {
      id: Date.now(), // Temporary ID for managing UI
      guest_first_name: guestForm.guest_first_name,
      guest_last_name: guestForm.guest_last_name,
      year_of_birth: parseInt(guestForm.year_of_birth),
      gender: guestForm.gender,
      team_id: parseInt(guestForm.team_id),
      products: guestProductDetails,
      comments: guestComments
    };

    setPendingGuests([...pendingGuests, newGuest]);
    setMessage(`Guest ${guestForm.guest_first_name} added!`);
    setShowGuestForm(false);
    setGuestForm({
      guest_first_name: '',
      guest_last_name: '',
      year_of_birth: new Date().getFullYear() - 18,
      gender: '',
      team_id: ''
    });
    setGuestProducts({});
    setGuestFieldValues({});
    setGuestComments('');
  };
  
  const removeGuestFromList = (guestId) => {
    setPendingGuests(pendingGuests.filter(g => g.id !== guestId));
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
  const isEventPast = event.ends_at && now > new Date(event.ends_at);

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto' }}>
      <div className="card">
        <h2>{event.title}</h2>
        <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0' }}>
          📍 {event.location}<br />
          📅 {formatDateTime(event.starts_at)} — {formatDateTime(event.ends_at)}
        </p>
        <p style={{ margin: '1rem 0', whiteSpace: 'pre-wrap' }}>{event.description}</p>
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

        {user && !full && registrationOpen && !isEventPast && (
      <>
      {isRegistered ? (
        <div style={{ background: '#e3f2fd', padding: '1rem', borderRadius: '6px', borderLeft: '4px solid #2196f3', marginBottom: '1.5rem' }}>
          <p style={{ margin: 0, color: '#1565c0', fontWeight: 500 }}>✓ You are already registered for this event</p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#0d47a1' }}>To modify your registration, contact the event organizers or use the "Cancel registration" button below.</p>
        </div>
      ) : (
        <>
          <h3 style={{ marginBottom: '1rem' }}>Register yourself</h3>

          {(() => {
            const canRegisterIndividually = event.allow_individual_registration;

            if (!canRegisterIndividually && allowedTeams.length === 0) {
            return (
              <p style={{ color: '#c0392b' }}>
              Individual registration is not allowed for this event and there are no available teams.
              </p>
            );
            }

        return (
        <>
          {(canRegisterIndividually || allowedTeams.length > 0) && (
          <div>
            <label>Register as part of a team {!canRegisterIndividually ? '(required)' : '(optional)'}</label>
            <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)}>
            {canRegisterIndividually && <option value="">No team — register individually</option>}
            {allowedTeams.map(team => (
              <option key={team.team_id} value={team.team_id}>{team.name}</option>
            ))}
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

          {showReview && pendingRegistration ? (
            <div ref={reviewRef} style={{ marginTop: '2rem' }}>
              <RegistrationReview
                products={pendingRegistration.captain.products}
                eventTitle={event.title}
                teamName={pendingRegistration.captain.teamName}
                comments={pendingRegistration.captain.comments}
                totalAmount={pendingRegistration.totalAmount}
                onConfirm={handleReviewConfirm}
                onCancel={handleReviewCancel}
                captainName={user ? `${user.first_name} ${user.last_name}`.trim() : 'You'}
                guests={pendingRegistration.guests}
                allProducts={products}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={register}>Continue to payment</button>
            </div>
          )}
        </>
          );
          })()}
        </>
      )}

      {isRegistered && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn-danger" onClick={cancel}>Cancel registration</button>
        </div>
      )}

            {captainTeams.filter(t => allowedTeams.some(at => at.team_id === t.id)).length > 0 && (
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
<label>Year of birth</label>
                    <input
                      type="number"
                      value={guestForm.year_of_birth}
                      onChange={e => setGuestForm({ ...guestForm, year_of_birth: e.target.value })}
                      min="1940"
                      max={new Date().getFullYear()}
                      required
                    />

                    <label>Gender</label>
                    <select
                      value={guestForm.gender}
                      onChange={e => setGuestForm({ ...guestForm, gender: e.target.value })}
                      required
                    >
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>

                    <label>Team</label>
                    <select
                      value={guestForm.team_id}
                      onChange={e => setGuestForm({ ...guestForm, team_id: e.target.value })}
                      required
                    >
                      <option value="">Select team...</option>
                      {captainTeams.filter(t => allowedTeams.some(at => at.team_id === t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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

                {/* Show pending guests */}
                {pendingGuests.length > 0 && (
                  <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--surface-2)', borderRadius: '6px' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '1rem' }}>Guests to register ({pendingGuests.length})</h4>
                    {pendingGuests.map((guest) => (
                      <div key={guest.id} style={{
                        padding: '0.8rem',
                        background: 'var(--surface-3)',
                        borderRadius: '4px',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <strong>{guest.guest_first_name} {guest.guest_last_name}</strong>
                          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {guest.products.length} product{guest.products.length !== 1 ? 's' : ''} •
                            €{guest.products.reduce((s, p) => s + (p.price * p.quantity), 0).toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => removeGuestFromList(guest.id)}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
      {captainTeams.filter(t => allowedTeams.some(at => at.team_id === t.id)).length > 0 && teamRegistrations.length > 0 && (
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Team registrations</h3>
        {captainTeams.filter(t => allowedTeams.some(at => at.team_id === t.id)).map(team => {
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
            <h4 style={{ marginBottom: '0.5rem', color: 'var(--accent)' }}>
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
              isEventPast={isEventPast}
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