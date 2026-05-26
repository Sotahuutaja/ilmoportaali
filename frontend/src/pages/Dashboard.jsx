import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', location: '',
    starts_at: '', ends_at: '', capacity: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'creator')) {
      navigate('/');
    }
    api.get('/events').then(res => setEvents(res.data.events));
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
      setForm({ title: '', description: '', location: '', starts_at: '', ends_at: '', capacity: '' });
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

  return (
    <div>
      <h2 style={{ margin: '1.5rem 0' }}>Dashboard</h2>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Create new event</h3>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleCreate}>
          <label>Title</label>
          <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
          <label>Description</label>
          <textarea rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          <label>Location</label>
          <input value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
          <label>Starts at</label>
          <input type="datetime-local" value={form.starts_at} onChange={e => setForm({...form, starts_at: e.target.value})} required />
          <label>Ends at</label>
          <input type="datetime-local" value={form.ends_at} onChange={e => setForm({...form, ends_at: e.target.value})} required />
          <label>Capacity (leave blank for unlimited)</label>
          <input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} />
          <button type="submit" className="btn btn-primary">Create event</button>
        </form>
      </div>

      <h3 style={{ margin: '1.5rem 0 1rem' }}>Your events</h3>
      {events.filter(e => user.role === 'admin' || e.creator_id === user.id).map(event => (
        <div className="card" key={event.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>{event.title}</strong>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              {new Date(event.starts_at).toLocaleDateString('fi-FI')} &nbsp;|&nbsp;
              {event.registration_count} registered
              {event.capacity ? ` / ${event.capacity}` : ''}
            </p>
          </div>
          <button className="btn btn-danger" onClick={() => handleDelete(event.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}