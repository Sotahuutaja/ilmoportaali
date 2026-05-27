import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';

export default function EditEvent() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '', description: '', location: '',
    starts_at: '', ends_at: '', capacity: ''
  });
  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', quantity: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [productMessage, setProductMessage] = useState('');
  const [productError, setProductError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'creator')) {
      navigate('/');
      return;
    }
    Promise.all([
      api.get(`/events/${id}`),
      api.get(`/events/${id}/products`)
    ]).then(([eventRes, productsRes]) => {
      const e = eventRes.data.event;
      setForm({
        title: e.title,
        description: e.description || '',
        location: e.location || '',
        starts_at: e.starts_at ? e.starts_at.slice(0, 16) : '',
        ends_at: e.ends_at ? e.ends_at.slice(0, 16) : '',
        capacity: e.capacity || ''
      });
      setProducts(productsRes.data.products);
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
        capacity: form.capacity ? parseInt(form.capacity) : null
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
        quantity: productForm.quantity ? parseInt(productForm.quantity) : null
      });
      setProducts([...products, res.data.product]);
      setProductMessage('Product added!');
      setProductForm({ name: '', description: '', price: '', quantity: '' });
    } catch (err) {
      setProductError(err.response?.data?.error || 'Failed to add product');
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
          <input
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            required
          />
          <label>Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />
          <label>Location</label>
          <input
            value={form.location}
            onChange={e => setForm({ ...form, location: e.target.value })}
          />
          <label>Starts at</label>
          <input
            type="datetime-local"
            value={form.starts_at}
            onChange={e => setForm({ ...form, starts_at: e.target.value })}
            required
          />
          <label>Ends at</label>
          <input
            type="datetime-local"
            value={form.ends_at}
            onChange={e => setForm({ ...form, ends_at: e.target.value })}
            required
          />
          <label>Capacity (leave blank for unlimited)</label>
          <input
            type="number"
            value={form.capacity}
            onChange={e => setForm({ ...form, capacity: e.target.value })}
          />
          <button type="submit" className="btn btn-primary">Save changes</button>
        </form>
      </div>

      {/* Products */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Products</h3>
        {productError && <p className="error">{productError}</p>}
        {productMessage && <p className="success">{productMessage}</p>}

        {products.map(p => (
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

        {products.length === 0 && (
          <p style={{ color: '#888', marginBottom: '1rem' }}>No products yet.</p>
        )}

        <form onSubmit={handleAddProduct} style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Add product</h4>
          <label>Name</label>
          <input
            value={productForm.name}
            onChange={e => setProductForm({ ...productForm, name: e.target.value })}
            required
          />
          <label>Description</label>
          <input
            value={productForm.description}
            onChange={e => setProductForm({ ...productForm, description: e.target.value })}
          />
          <label>Price (€)</label>
          <input
            type="number" step="0.01" min="0"
            value={productForm.price}
            onChange={e => setProductForm({ ...productForm, price: e.target.value })}
            required
          />
          <label>Quantity limit (leave blank for unlimited)</label>
          <input
            type="number" min="1"
            value={productForm.quantity}
            onChange={e => setProductForm({ ...productForm, quantity: e.target.value })}
          />
          <button type="submit" className="btn btn-primary">Add product</button>
        </form>
      </div>
    </div>
  );
}