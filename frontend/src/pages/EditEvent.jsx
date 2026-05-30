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
    registration_starts_at: '', registration_ends_at: ''
  });
  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', quantity: '', fields: [] });
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

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'creator')) {
      navigate('/');
      return;
    }
    Promise.all([
    api.get(`/events/${id}`),
    api.get(`/events/${id}/products`),
    api.get(`/events/${id}/teams`),
    api.get('/teams')
  ]).then(([eventRes, productsRes, eventTeamsRes, allTeamsRes]) => {
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
      registration_ends_at: toHelsinki(e.registration_ends_at)
    });
    setProducts(productsRes.data.products);
    setEventTeams(eventTeamsRes.data.teams);
    setAllTeams(allTeamsRes.data.teams);
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
        registration_ends_at: helsinkiToUTC(form.registration_ends_at)
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
        ...productForm,
        price: parseFloat(productForm.price) || 0,
        quantity: productForm.quantity ? parseInt(productForm.quantity) : null,
        fields: productForm.fields
      });
      setProducts([...products, res.data.product]);
      setProductMessage('Product added!');
      setProductForm({ name: '', description: '', price: '', quantity: '', fields: [] });
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
        fields: editingProduct.fields || []
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
          <label>Registration opens at <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85rem' }}>(Finnish time, EET/EEST)</span></label>
          <input type="datetime-local" value={form.registration_starts_at} onChange={e => setForm({ ...form, registration_starts_at: e.target.value })} required />
          <label>Registration closes at <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85rem' }}>(Finnish time, EET/EEST)</span></label>
          <input type="datetime-local" value={form.registration_ends_at} onChange={e => setForm({ ...form, registration_ends_at: e.target.value })} required />
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
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={e => e.preventDefault()}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.6rem 0.5rem', marginBottom: '0.3rem',
              borderRadius: '6px', border: '1px solid var(--border)',
              background: 'var(--surface-2)', cursor: 'grab'
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
                </div>
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
              </div>
            )}
            {editingProduct?.id !== p.id && (
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button className="btn btn-secondary" onClick={() => setEditingProduct({ ...p })}>Edit</button>
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
          <ProductFieldEditor
            fields={productForm.fields}
            onChange={fields => setProductForm({ ...productForm, fields })}
          />
          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.75rem' }}>Add product</button>
        </form>
      </div>
    
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3 style={{ marginBottom: '1rem' }}>Allowed teams</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
      Only members of these teams can register under a team for this event.
      </p>
      {teamError && <p className="error">{teamError}</p>}
      {teamMessage && <p className="success">{teamMessage}</p>}

      {eventTeams.map(t => (
      <div key={t.team_id} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.5rem 0', borderBottom: '1px solid var(--border)'
      }}>
        <div>
        <strong>{t.name}</strong>
        <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
          {t.member_count} members
        </span>
        </div>
        <button className="btn btn-danger" onClick={() => handleRemoveTeam(t.team_id)}>Remove</button>
      </div>
      ))}

      {eventTeams.length === 0 && (
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No teams allowed yet — all team registrations are blocked.</p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
      <select
        defaultValue=""
        onChange={e => { if (e.target.value) { handleAddTeam(e.target.value); e.target.value = ''; } }}
        style={{ flex: 1, marginBottom: 0 }}
      >
        <option value="">Add a team...</option>
        {allTeams
        .filter(t => !eventTeams.find(et => et.team_id === t.id))
        .map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      </div>
    </div>
    </div>
  );
}