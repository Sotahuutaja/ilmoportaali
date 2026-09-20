import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import { toHelsinki, helsinkiToUTC } from '../utils/datetime';
import ProductFieldEditor from '../components/ProductFieldEditor';

export default function EditEvent() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '', description: '', location: '',
    starts_at: '', ends_at: '', capacity: '',
    allow_individual_registration: true,
    registration_starts_at: '', registration_ends_at: '',
    stripe_mode: 'test',
    volunteering_enabled: false,
    restrict_visibility: false
  });
  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', quantity: '', fields: [], available_from: '', available_until: '', is_identifying: false });
  const [editingProduct, setEditingProduct] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [productMessage, setProductMessage] = useState('');
  const [productError, setProductError] = useState('');
  const [loading, setLoading] = useState(true);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [eventTeams, setEventTeams] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [teamMessage, setTeamMessage] = useState('');
  const [teamError, setTeamError] = useState('');
  const [volunteerRoles, setVolunteerRoles] = useState([]);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', capacity: '' });
  const [editingRole, setEditingRole] = useState(null);
  const [roleMessage, setRoleMessage] = useState('');
  const [roleError, setRoleError] = useState('');
  const [discountForm, setDiscountForm] = useState({}); // keyed by roleId -> { product_id, discount_type, discount_value }

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'creator')) {
      navigate('/');
      return;
    }
    Promise.all([
    api.get(`/events/${id}`),
    api.get(`/events/${id}/products`),
    api.get(`/events/${id}/teams`),
    api.get('/teams'),
    api.get(`/events/${id}/volunteers/roles`)
  ]).then(([eventRes, productsRes, eventTeamsRes, allTeamsRes, volunteerRolesRes]) => {
    const e = eventRes.data.event;
    setForm({
      title: e.title,
      description: e.description || '',
      location: e.location || '',
      starts_at: toHelsinki(e.starts_at),
      ends_at: toHelsinki(e.ends_at),
      capacity: e.capacity || '',
      allow_individual_registration: e.allow_individual_registration ?? true,
      registration_starts_at: toHelsinki(e.registration_starts_at),
      registration_ends_at: toHelsinki(e.registration_ends_at),
      stripe_mode: e.stripe_mode || 'test',
      volunteering_enabled: e.volunteering_enabled ?? false,
      restrict_visibility: e.restrict_visibility ?? false
    });
    setProducts(productsRes.data.products);
    setEventTeams(eventTeamsRes.data.teams);
    setAllTeams(allTeamsRes.data.teams);
    setVolunteerRoles(volunteerRolesRes.data.roles);
  }).catch(() => {
    setError('Failed to load event');
  }).finally(() => setLoading(false));
  }, [id, user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      await api.put(`/events/${id}`, {
        ...form,
        capacity: form.capacity ? parseInt(form.capacity) : null,
        starts_at: helsinkiToUTC(form.starts_at),
        ends_at: helsinkiToUTC(form.ends_at),
        registration_starts_at: helsinkiToUTC(form.registration_starts_at),
        registration_ends_at: helsinkiToUTC(form.registration_ends_at),
        stripe_mode: form.stripe_mode
      });
      setMessage('Event updated successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update event');
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setProductError(''); setProductMessage('');
    try {
      const res = await api.post(`/events/${id}/products`, {
        name: productForm.name,
        description: productForm.description,
        price: parseFloat(productForm.price) || 0,
        quantity: productForm.quantity ? parseInt(productForm.quantity) : null,
        fields: productForm.fields,
        available_from: productForm.available_from ? helsinkiToUTC(productForm.available_from) : null,
        available_until: productForm.available_until ? helsinkiToUTC(productForm.available_until) : null,
        is_identifying: !!productForm.is_identifying
      });
      setProducts([...products, res.data.product]);
      setProductMessage('Product added!');
      setProductForm({ name: '', description: '', price: '', quantity: '', fields: [], available_from: '', available_until: '', is_identifying: false });
    } catch (err) {
      setProductError(err.response?.data?.error || 'Failed to add product');
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    setProductError(''); setProductMessage('');
    try {
      const res = await api.put(`/events/${id}/products/${editingProduct.id}`, {
        name: editingProduct.name,
        description: editingProduct.description,
        price: parseFloat(editingProduct.price) || 0,
        quantity: editingProduct.quantity ? parseInt(editingProduct.quantity) : null,
        fields: editingProduct.fields || [],
        available_from: editingProduct.available_from ? helsinkiToUTC(editingProduct.available_from) : null,
        available_until: editingProduct.available_until ? helsinkiToUTC(editingProduct.available_until) : null,
        is_identifying: !!editingProduct.is_identifying
      });
      setProducts(products.map(p => p.id === editingProduct.id ? res.data.product : p));
      setProductMessage('Product updated!');
      setEditingProduct(null);
    } catch (err) {
      setProductError(err.response?.data?.error || 'Failed to update product');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await api.delete(`/events/${id}/products/${productId}`);
      setProducts(products.filter(p => p.id !== productId));
    } catch (err) {
      setProductError(err.response?.data?.error || 'Failed to delete product');
    }
  };

  const handleDragStart = (index) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index) => {
    dragOverItem.current = index;
    const newProducts = [...products];
    const dragged = newProducts.splice(dragItem.current, 1)[0];
    newProducts.splice(dragOverItem.current, 0, dragged);
    dragItem.current = dragOverItem.current;
    setProducts(newProducts);
  };

  const handleDragEnd = async () => {
    dragItem.current = null;
    dragOverItem.current = null;
    try {
      await api.put(`/events/${id}/products/reorder`, {
        order: products.map(p => p.id)
      });
    } catch (err) {
      setProductError('Failed to save order');
    }
  };
  
  const handleAddTeam = async (teamId) => {
    setTeamError(''); setTeamMessage('');
    try {
      await api.post(`/events/${id}/teams`, { team_id: parseInt(teamId) });
      const res = await api.get(`/events/${id}/teams`);
      setEventTeams(res.data.teams);
      setTeamMessage('Team added!');
    } catch (err) {
      setTeamError(err.response?.data?.error || 'Failed to add team');
    }
  };

  const handleRemoveTeam = async (teamId) => {
    try {
      await api.delete(`/events/${id}/teams/${teamId}`);
      setEventTeams(eventTeams.filter(t => t.team_id !== teamId));
      setTeamMessage('Team removed.');
    } catch (err) {
      setTeamError(err.response?.data?.error || 'Failed to remove team');
    }
  };

  const handleAddRole = async (e) => {
    e.preventDefault();
    setRoleError(''); setRoleMessage('');
    try {
      const res = await api.post(`/events/${id}/volunteers/roles`, {
        name: roleForm.name,
        description: roleForm.description,
        capacity: roleForm.capacity ? parseInt(roleForm.capacity) : null
      });
      setVolunteerRoles([...volunteerRoles, res.data.role]);
      setRoleMessage('Role added!');
      setRoleForm({ name: '', description: '', capacity: '' });
    } catch (err) {
      setRoleError(err.response?.data?.error || 'Failed to add role');
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    setRoleError(''); setRoleMessage('');
    try {
      const res = await api.put(`/events/${id}/volunteers/roles/${editingRole.id}`, {
        name: editingRole.name,
        description: editingRole.description,
        capacity: editingRole.capacity ? parseInt(editingRole.capacity) : null
      });
      setVolunteerRoles(volunteerRoles.map(r => r.id === editingRole.id ? { ...res.data.role, discounts: r.discounts, approved_count: r.approved_count } : r));
      setRoleMessage('Role updated!');
      setEditingRole(null);
    } catch (err) {
      setRoleError(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm('Delete this volunteer role?')) return;
    setRoleError(''); setRoleMessage('');
    try {
      await api.delete(`/events/${id}/volunteers/roles/${roleId}`);
      setVolunteerRoles(volunteerRoles.filter(r => r.id !== roleId));
    } catch (err) {
      setRoleError(err.response?.data?.error || 'Failed to delete role');
    }
  };

  const handleSetDiscount = async (roleId) => {
    setRoleError(''); setRoleMessage('');
    const form = discountForm[roleId];
    if (!form?.product_id || !form?.discount_type) {
      setRoleError('Choose a product and a discount type');
      return;
    }
    try {
      const res = await api.post(`/events/${id}/volunteers/roles/${roleId}/discounts`, {
        product_id: parseInt(form.product_id),
        discount_type: form.discount_type,
        discount_value: form.discount_type === 'free' ? null : parseFloat(form.discount_value)
      });
      setVolunteerRoles(volunteerRoles.map(r => {
        if (r.id !== roleId) return r;
        const discounts = r.discounts.filter(d => d.product_id !== res.data.discount.product_id);
        return { ...r, discounts: [...discounts, res.data.discount] };
      }));
      setDiscountForm({ ...discountForm, [roleId]: { product_id: '', discount_type: '', discount_value: '' } });
      setRoleMessage('Discount saved!');
    } catch (err) {
      setRoleError(err.response?.data?.error || 'Failed to save discount');
    }
  };

  const handleRemoveDiscount = async (roleId, productId) => {
    setRoleError(''); setRoleMessage('');
    try {
      await api.delete(`/events/${id}/volunteers/roles/${roleId}/discounts/${productId}`);
      setVolunteerRoles(volunteerRoles.map(r =>
        r.id === roleId ? { ...r, discounts: r.discounts.filter(d => d.product_id !== productId) } : r
      ));
    } catch (err) {
      setRoleError(err.response?.data?.error || 'Failed to remove discount');
    }
  };

  const handleToggleAutoJoin = async (teamId, currentValue) => {
    try {
      const res = await api.patch(`/events/${id}/teams/${teamId}/auto-join`, {
        auto_approve_joins: !currentValue
      });
      setEventTeams(eventTeams.map(t =>
        t.team_id === teamId ? res.data.eventTeam : t
      ));
      setTeamMessage(`Auto-join ${!currentValue ? 'enabled' : 'disabled'} for this team.`);
    } catch (err) {
      setTeamError(err.response?.data?.error || 'Failed to update team settings');
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Edit event</h2>
        <Link to="/dashboard">
          <button className="btn btn-secondary">Back to Event Management</button>
        </Link>
      </div>

      {/* Event details */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Event details</h3>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
        <form onSubmit={handleSave}>
          <label>Title</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          <label>Description</label>
          <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <label>Location</label>
          <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          <label>Starts at <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85rem' }}>(Finnish time, EET/EEST)</span></label>
          <input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} required />
          <label>Ends at <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85rem' }}>(Finnish time, EET/EEST)</span></label>
          <input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} required />
          <label>Capacity (leave blank for unlimited)</label>
          <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <input type="checkbox" checked={form.allow_individual_registration} onChange={e => setForm({ ...form, allow_individual_registration: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
            Allow individual registration (without a team)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <input type="checkbox" checked={form.volunteering_enabled} onChange={e => setForm({ ...form, volunteering_enabled: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
            Recruit volunteers for this event through the portal
          </label>
          {form.volunteering_enabled === false && volunteerRoles.length > 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>
              Turning this off only blocks new applications — existing roles, applications and benefits are kept.
            </p>
          )}
          <label>Registration opens at <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85rem' }}>(Finnish time, EET/EEST)</span></label>
          <input type="datetime-local" value={form.registration_starts_at} onChange={e => setForm({ ...form, registration_starts_at: e.target.value })} required />
          <label>Registration closes at <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85rem' }}>(Finnish time, EET/EEST)</span></label>
          <input type="datetime-local" value={form.registration_ends_at} onChange={e => setForm({ ...form, registration_ends_at: e.target.value })} required />
          <label>Payment Mode</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setForm({ ...form, stripe_mode: 'test' })}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: form.stripe_mode === 'test' ? '#ff9800' : 'transparent',
                color: form.stripe_mode === 'test' ? 'white' : 'var(--text)',
                cursor: 'pointer',
                fontWeight: form.stripe_mode === 'test' ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
            >
              Test Mode
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, stripe_mode: 'live' })}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: form.stripe_mode === 'live' ? '#4caf50' : 'transparent',
                color: form.stripe_mode === 'live' ? 'white' : 'var(--text)',
                cursor: 'pointer',
                fontWeight: form.stripe_mode === 'live' ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
            >
              Live Mode
            </button>
          </div>
          <button type="submit" className="btn btn-primary">Save changes</button>
        </form>
      </div>

      {/* Products */}
      <div className="card">
        <h3 style={{ marginBottom: '0.5rem' }}>Products</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>Drag to reorder</p>
        {productError && <p className="error">{productError}</p>}
        {productMessage && <p className="success">{productMessage}</p>}

        {products.map((p, index) => (
          <div
            key={p.id}
            // Only draggable while this row is showing its collapsed summary — a
            // draggable ancestor swallows click-drag gestures inside descendant text
            // inputs (the browser treats the drag as "move this row" instead of "select
            // this text"), so the inline edit form below must not be inside a draggable
            // element or its text fields become impossible to select by dragging.
            draggable={editingProduct?.id !== p.id}
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={e => e.preventDefault()}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.6rem 0.5rem', marginBottom: '0.3rem',
              borderRadius: '6px', border: '1px solid var(--border)',
              background: 'var(--surface-2)', cursor: editingProduct?.id === p.id ? 'default' : 'grab'
            }}
          >
            {editingProduct?.id === p.id ? (
              <form onSubmit={handleUpdateProduct} style={{ flex: 1, marginRight: '0.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem' }}>Name</label>
                    <input value={editingProduct.name} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} required style={{ marginBottom: 0 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem' }}>Description</label>
                    <input value={editingProduct.description || ''} onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} style={{ marginBottom: 0 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem' }}>Price (€)</label>
                    <input type="number" step="0.01" min="0" value={editingProduct.price} onChange={e => setEditingProduct({ ...editingProduct, price: e.target.value })} required style={{ marginBottom: 0 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem' }}>Quantity limit</label>
                    <input type="number" min="1" value={editingProduct.quantity || ''} onChange={e => setEditingProduct({ ...editingProduct, quantity: e.target.value })} style={{ marginBottom: 0 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem' }}>Available from <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(Finnish time, EET/EEST)</span></label>
                    <input type="datetime-local" value={editingProduct.available_from || ''} onChange={e => setEditingProduct({ ...editingProduct, available_from: e.target.value })} style={{ marginBottom: 0 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem' }}>Available until <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(Finnish time, EET/EEST)</span></label>
                    <input type="datetime-local" value={editingProduct.available_until || ''} onChange={e => setEditingProduct({ ...editingProduct, available_until: e.target.value })} style={{ marginBottom: 0 }} />
                  </div>
                </div>
                <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={!!editingProduct.is_identifying}
                    onChange={e => setEditingProduct({ ...editingProduct, is_identifying: e.target.checked })}
                    style={{ marginBottom: 0, width: 'auto' }}
                  />
                  Identifies a registrant (e.g. a ticket) — at most one such product per registration
                </label>
                <ProductFieldEditor
                  fields={editingProduct.fields || []}
                  onChange={fields => setEditingProduct({ ...editingProduct, fields })}
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button type="submit" className="btn btn-primary">Save</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingProduct(null)}>Cancel</button>
                </div>
              </form>
            ) : (
              <div style={{ flex: 1 }}>
                <span style={{ cursor: 'grab', marginRight: '0.5rem', color: 'var(--text-muted)' }}>⠿</span>
                <strong>{p.name}</strong>
                {p.description && <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.9rem' }}>{p.description}</span>}
                <span style={{ marginLeft: '0.5rem' }}>€{parseFloat(p.price).toFixed(2)}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                  {p.quantity !== null ? `${p.remaining ?? p.quantity} / ${p.quantity} left` : 'Unlimited'}
                </span>
                {p.is_identifying && (
                  <span style={{
                    fontSize: '0.75rem', padding: '0.1rem 0.4rem', marginLeft: '0.5rem',
                    borderRadius: '8px', background: '#2196f3', color: 'white'
                  }}>
                    ticket
                  </span>
                )}
                {(p.available_from || p.available_until) && (
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', padding: '0.2rem 0.5rem', borderRadius: '3px', background: p.is_available ? '#e8f5e9' : '#ffebee', color: p.is_available ? '#2e7d32' : '#c62828' }}>
                    {p.available_from && <span>From {new Date(p.available_from).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' })}</span>}
                    {p.available_from && p.available_until && <span> → </span>}
                    {p.available_until && <span>To {new Date(p.available_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' })}</span>}
                    {p.is_available === false && <span> (Expired)</span>}
                  </span>
                )}
                {p.fields && p.fields.length > 0 && (
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    · {p.fields.map(f => `${f.label} (${f.type === 'select' ? f.options.join(', ') : 'text'})`).join(' · ')}
                  </span>
                )}
              </div>
            )}
            {editingProduct?.id !== p.id && (
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button className="btn btn-secondary" onClick={() => setEditingProduct({ ...p, available_from: toHelsinki(p.available_from), available_until: toHelsinki(p.available_until) })}>Edit</button>
                <button className="btn btn-danger" onClick={() => handleDeleteProduct(p.id)}>Delete</button>
              </div>
            )}
          </div>
        ))}

        {products.length === 0 && (
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No products yet.</p>
        )}

        <form onSubmit={handleAddProduct} style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Add product</h4>
          <label>Name</label>
          <input value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} required />
          <label>Description</label>
          <input value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })} />
          <label>Price (€)</label>
          <input type="number" step="0.01" min="0" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })} required />
          <label>Quantity limit (leave blank for unlimited)</label>
          <input type="number" min="1" value={productForm.quantity} onChange={e => setProductForm({ ...productForm, quantity: e.target.value })} />
          <label>Available from (optional) <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85rem' }}>(Finnish time, EET/EEST)</span></label>
          <input type="datetime-local" value={productForm.available_from} onChange={e => setProductForm({ ...productForm, available_from: e.target.value })} />
          <label>Available until (optional) <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85rem' }}>(Finnish time, EET/EEST)</span></label>
          <input type="datetime-local" value={productForm.available_until} onChange={e => setProductForm({ ...productForm, available_until: e.target.value })} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="checkbox"
              checked={!!productForm.is_identifying}
              onChange={e => setProductForm({ ...productForm, is_identifying: e.target.checked })}
              style={{ marginBottom: 0, width: 'auto' }}
            />
            Identifies a registrant (e.g. a ticket) — at most one such product per registration
          </label>
          <ProductFieldEditor
            fields={productForm.fields}
            onChange={fields => setProductForm({ ...productForm, fields })}
          />
          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.75rem' }}>Add product</button>
        </form>
      </div>
    
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.5rem' }}>Volunteer roles</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Roles volunteers can apply for, and the per-product discount or benefit each role earns once approved.
      </p>
      {roleError && <p className="error">{roleError}</p>}
      {roleMessage && <p className="success">{roleMessage}</p>}

      {volunteerRoles.map(role => (
        <div key={role.id} style={{
          padding: '0.6rem', marginBottom: '0.5rem', borderRadius: '6px',
          border: '1px solid var(--border)', background: 'var(--surface-2)'
        }}>
          {editingRole?.id === role.id ? (
            <form onSubmit={handleUpdateRole}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem' }}>Name</label>
                  <input value={editingRole.name} onChange={e => setEditingRole({ ...editingRole, name: e.target.value })} required style={{ marginBottom: 0 }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem' }}>Description</label>
                  <input value={editingRole.description || ''} onChange={e => setEditingRole({ ...editingRole, description: e.target.value })} style={{ marginBottom: 0 }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem' }}>Capacity (blank = unlimited)</label>
                  <input type="number" min="1" value={editingRole.capacity || ''} onChange={e => setEditingRole({ ...editingRole, capacity: e.target.value })} style={{ marginBottom: 0 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingRole(null)}>Cancel</button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <strong>{role.name}</strong>
                {role.description && <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.9rem' }}>{role.description}</span>}
                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                  {role.approved_count} approved{role.capacity !== null ? ` / ${role.capacity}` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button className="btn btn-secondary" onClick={() => setEditingRole(role)}>Edit</button>
                <button className="btn btn-danger" onClick={() => handleDeleteRole(role.id)}>Delete</button>
              </div>
            </div>
          )}

          {/* Per-product discounts for this role */}
          <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px dashed var(--border)' }}>
            {role.discounts.length > 0 && (
              <div style={{ marginBottom: '0.5rem' }}>
                {role.discounts.map(d => {
                  const product = products.find(p => p.id === d.product_id);
                  const label = d.discount_type === 'free' ? 'Free'
                    : d.discount_type === 'percent' ? `${d.discount_value}% off`
                    : d.discount_type === 'fixed_amount' ? `€${d.discount_value} off`
                    : `€${d.discount_value} fixed price`;
                  return (
                    <div key={d.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      <span>{product?.name || `Product #${d.product_id}`} — {label}</span>
                      <button className="btn btn-secondary" style={{ padding: '0.15rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleRemoveDiscount(role.id, d.product_id)}>Remove</button>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={discountForm[role.id]?.product_id || ''}
                onChange={e => setDiscountForm({ ...discountForm, [role.id]: { ...discountForm[role.id], product_id: e.target.value } })}
                style={{ marginBottom: 0, flex: '1 1 140px' }}
              >
                <option value="">Product...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select
                value={discountForm[role.id]?.discount_type || ''}
                onChange={e => setDiscountForm({ ...discountForm, [role.id]: { ...discountForm[role.id], discount_type: e.target.value } })}
                style={{ marginBottom: 0, flex: '1 1 120px' }}
              >
                <option value="">Benefit type...</option>
                <option value="free">Free</option>
                <option value="percent">% off</option>
                <option value="fixed_amount">€ off</option>
                <option value="override_price">Fixed price</option>
              </select>
              {discountForm[role.id]?.discount_type && discountForm[role.id]?.discount_type !== 'free' && (
                <input
                  type="number" step="0.01" min="0" placeholder="Value"
                  value={discountForm[role.id]?.discount_value || ''}
                  onChange={e => setDiscountForm({ ...discountForm, [role.id]: { ...discountForm[role.id], discount_value: e.target.value } })}
                  style={{ marginBottom: 0, width: '90px' }}
                />
              )}
              <button type="button" className="btn btn-primary" onClick={() => handleSetDiscount(role.id)}>Set</button>
            </div>
          </div>
        </div>
      ))}

      {volunteerRoles.length === 0 && (
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No volunteer roles yet.</p>
      )}

      <form onSubmit={handleAddRole} style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
        <h4 style={{ marginBottom: '0.5rem' }}>Add role</h4>
        <label>Name</label>
        <input value={roleForm.name} onChange={e => setRoleForm({ ...roleForm, name: e.target.value })} required />
        <label>Description</label>
        <input value={roleForm.description} onChange={e => setRoleForm({ ...roleForm, description: e.target.value })} />
        <label>Capacity (leave blank for unlimited)</label>
        <input type="number" min="1" value={roleForm.capacity} onChange={e => setRoleForm({ ...roleForm, capacity: e.target.value })} />
        <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Add role</button>
      </form>
    </div>

    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3 style={{ marginBottom: '1rem' }}>Allowed teams</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
      Only members of these teams can register under a team for this event.
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <input
          type="checkbox"
          checked={form.restrict_visibility}
          disabled={!form.restrict_visibility && eventTeams.length === 0}
          onChange={e => setForm({ ...form, restrict_visibility: e.target.checked })}
          style={{ width: 'auto', margin: 0 }}
        />
        Only show this event to eligible teams' members (hides it entirely from everyone else)
      </label>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
        {eventTeams.length === 0
          ? 'Add at least one eligible team below before restricting visibility.'
          : 'The event\'s creator, co-managers, admins, and anyone already registered can still always see it.'}
        {' '}Remember to click "Save changes" above after changing this.
      </p>

      {teamError && <p className="error">{teamError}</p>}
      {teamMessage && <p className="success">{teamMessage}</p>}

      {allTeams.map(t => {
        const eventTeam = eventTeams.find(et => et.team_id === t.id);
        const isAllowed = !!eventTeam;
        return (
          <div key={t.id} style={{
            padding: '0.5rem 0', borderBottom: '1px solid var(--border)'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isAllowed}
                onChange={() => isAllowed ? handleRemoveTeam(t.id) : handleAddTeam(t.id)}
                style={{ width: 'auto', margin: 0 }}
              />
              <strong>{t.name}</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.member_count} members</span>
            </label>
            {isAllowed && (
              <div style={{ marginTop: '0.4rem', marginLeft: '1.6rem', fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={eventTeam.auto_approve_joins || false}
                    onChange={() => handleToggleAutoJoin(t.id, eventTeam.auto_approve_joins || false)}
                    style={{ margin: 0 }}
                  />
                  Auto-approve team joins
                </label>
              </div>
            )}
          </div>
        );
      })}

      {allTeams.length === 0 && (
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No teams exist yet.</p>
      )}
    </div>
    </div>
  );
}