import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';


export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', location: '',
    starts_at: '', ends_at: '', capacity: '',
    allow_individual_registration: true
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Product management
  const [managingProducts, setManagingProducts] = useState(null);
  const [eventProducts, setEventProducts] = useState([]);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', quantity: '' });
  const [productMessage, setProductMessage] = useState('');
  const [productError, setProductError] = useState('');
  const [managingManagers, setManagingManagers] = useState(null);
  const [eventManagers, setEventManagers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [managerMessage, setManagerMessage] = useState('');
  const [managerError, setManagerError] = useState('');
  const [newManagerId, setNewManagerId] = useState('');

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'creator')) {
      navigate('/');
      return;
    }
    api.get('/events/manageable').then(res => setEvents(res.data.events));
    api.get('/users').then(res =>
      setAllUsers(res.data.users.filter(u => ['creator', 'admin'].includes(u.role)))
    );
  }, [user]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      const res = await api.post('/events', {
        ...form,
        capacity: form.capacity ? parseInt(form.capacity) : null
      });
      setEvents([...events, res.data.event]);
      setMessage('Event created!');
      setForm({ title: '', description: '', location: '', starts_at: '', ends_at: '', capacity: '', allow_individual_registration: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create event');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await api.delete(`/events/${id}`);
      setEvents(events.filter(e => e.id !== id));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete event');
    }
  };

  const openProducts = async (event) => {
    setManagingProducts(event);
    setProductMessage(''); setProductError('');
    const res = await api.get(`/events/${event.id}/products`);
    setEventProducts(res.data.products);
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setProductError(''); setProductMessage('');
    try {
      const res = await api.post(`/events/${managingProducts.id}/products`, {
        ...productForm,
        price: parseFloat(productForm.price) || 0,
        quantity: productForm.quantity ? parseInt(productForm.quantity) : null
      });
      setEventProducts([...eventProducts, res.data.product]);
      setProductMessage('Product created!');
      setProductForm({ name: '', description: '', price: '', quantity: '' });
    } catch (err) {
      setProductError(err.response?.data?.error || 'Failed to create product');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await api.delete(`/events/${managingProducts.id}/products/${productId}`);
      setEventProducts(eventProducts.filter(p => p.id !== productId));
    } catch (err) {
      setProductError(err.response?.data?.error || 'Failed to delete product');
    }
  };

  const openManagers = async (event) => {
    setManagingManagers(event);
    setManagerMessage(''); setManagerError('');
    const res = await api.get(`/events/${event.id}/managers`);
    setEventManagers(res.data.managers);
  };

  const handleAddManager = async () => {
    if (!newManagerId) return;
    setManagerError(''); setManagerMessage('');
    try {
      await api.post(`/events/${managingManagers.id}/managers`, { user_id: parseInt(newManagerId) });
      const res = await api.get(`/events/${managingManagers.id}/managers`);
      setEventManagers(res.data.managers);
      setManagerMessage('Manager added!');
      setNewManagerId('');
    } catch (err) {
      setManagerError(err.response?.data?.error || 'Failed to add manager');
    }
  };

  const handleRemoveManager = async (userId) => {
    try {
      await api.delete(`/events/${managingManagers.id}/managers/${userId}`);
      setEventManagers(eventManagers.filter(m => m.user_id !== userId));
      setManagerMessage('Manager removed.');
    } catch (err) {
      setManagerError(err.response?.data?.error || 'Failed to remove manager');
    }
  };

  return (
    <div>
      <h2 style={{ margin: '1.5rem 0' }}>Event Management</h2>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Create new event</h3>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleCreate}>
          <label>Title</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          <label>Description</label>
          <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <label>Location</label>
          <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          <label>Starts at</label>
          <input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} required />
          <label>Ends at</label>
          <input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} required />
          <label>Capacity (leave blank for unlimited)</label>
          <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              checked={form.allow_individual_registration}
              onChange={e => setForm({ ...form, allow_individual_registration: e.target.checked })}
              style={{ width: 'auto', margin: 0 }}
            />
            Allow individual registration (without a team)
          </label>
          <button type="submit" className="btn btn-primary">Create event</button>
        </form>
      </div>

      <h3 style={{ margin: '1.5rem 0 1rem' }}>Your events</h3>
    {events.map(event => (
      <div className="card" key={event.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <strong>{event.title}</strong>
        {!event.is_owner && (
        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '8px', background: '#8e44ad', color: 'white' }}>co-manager</span>
        )}
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
        {new Date(event.starts_at).toLocaleDateString('fi-FI')} &nbsp;|&nbsp;
        {event.registration_count} registered
        {event.capacity ? ` / ${event.capacity}` : ''}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Link to={`/events/${event.id}/registrants`}><button className="btn btn-secondary">Participants</button></Link>
        <button className="btn btn-secondary" onClick={() => openManagers(event)}>Managers</button>
        <button className="btn btn-secondary" onClick={() => openProducts(event)}>Products</button>
        <Link to={`/events/${event.id}/edit`}><button className="btn btn-secondary">Edit</button></Link>
        {(event.is_owner || user.role === 'admin') && (
        <button className="btn btn-danger" onClick={() => handleDelete(event.id)}>Delete</button>
        )}
      </div>
      </div>
    ))}

      {managingProducts && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Products for: {managingProducts.title}</h3>
            <button className="btn btn-secondary" onClick={() => setManagingProducts(null)}>Close</button>
          </div>

          {productError && <p className="error">{productError}</p>}
          {productMessage && <p className="success">{productMessage}</p>}

          {eventProducts.map(p => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.5rem 0', borderBottom: '1px solid #f0f0f0'
            }}>
              <div>
                <strong>{p.name}</strong>
                {p.description && (
                  <span style={{ color: '#666', marginLeft: '0.5rem', fontSize: '0.9rem' }}>{p.description}</span>
                )}
                <span style={{ marginLeft: '0.5rem' }}>€{parseFloat(p.price).toFixed(2)}</span>
                <span style={{ color: '#888', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                  {p.quantity !== null ? `${p.remaining ?? p.quantity} / ${p.quantity} left` : 'Unlimited'}
                </span>
              </div>
              <button className="btn btn-danger" onClick={() => handleDeleteProduct(p.id)}>Delete</button>
            </div>
          ))}

          {eventProducts.length === 0 && (
            <p style={{ color: '#888', marginBottom: '1rem' }}>No products yet.</p>
          )}

          <form onSubmit={handleCreateProduct} style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Add product</h4>
            <label>Name</label>
            <input value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} required />
            <label>Description</label>
            <input value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })} />
            <label>Price (€)</label>
            <input type="number" step="0.01" min="0" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })} required />
            <label>Quantity limit (leave blank for unlimited)</label>
            <input type="number" min="1" value={productForm.quantity} onChange={e => setProductForm({ ...productForm, quantity: e.target.value })} />
            <button type="submit" className="btn btn-primary">Add product</button>
          </form>
        </div>
      )}
    
    {managingManagers && (
      <div className="card" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Managers for: {managingManagers.title}</h3>
        <button className="btn btn-secondary" onClick={() => setManagingManagers(null)}>Close</button>
      </div>

      {managerError && <p className="error">{managerError}</p>}
      {managerMessage && <p className="success">{managerMessage}</p>}

      {eventManagers.map(m => (
        <div key={m.user_id} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.5rem 0', borderBottom: '1px solid #f0f0f0'
        }}>
        <span>
          {m.first_name || m.last_name
          ? `${m.last_name || ''}, ${m.first_name || ''}`.trim()
          : m.email}
        </span>
        <button className="btn btn-danger" onClick={() => handleRemoveManager(m.user_id)}>Remove</button>
        </div>
      ))}
      {eventManagers.length === 0 && <p style={{ color: '#888', marginBottom: '1rem' }}>No co-managers yet.</p>}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
        <select
        value={newManagerId}
        onChange={e => setNewManagerId(e.target.value)}
        style={{ flex: 1, marginBottom: 0 }}
        >
        <option value="">Select a user to add...</option>
        {allUsers
          .filter(u => !eventManagers.find(m => m.user_id === u.id) && u.id !== managingManagers.creator_id)
          .map(u => (
          <option key={u.id} value={u.id}>
            {u.first_name || u.last_name
            ? `${u.last_name || ''}, ${u.first_name || ''}`.trim()
            : u.email}
          </option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={handleAddManager} disabled={!newManagerId}>
        Add manager
        </button>
      </div>
      </div>
    )}
    </div>
  );
}