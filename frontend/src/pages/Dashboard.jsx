import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { formatDate, helsinkiToUTC } from '../utils/datetime';


export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', location: '',
    starts_at: '', ends_at: '', capacity: '',
    allow_individual_registration: true,
    registration_starts_at: '', registration_ends_at: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
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
        capacity: form.capacity ? parseInt(form.capacity) : null,
        starts_at: helsinkiToUTC(form.starts_at),
        ends_at: helsinkiToUTC(form.ends_at),
        registration_starts_at: helsinkiToUTC(form.registration_starts_at),
        registration_ends_at: helsinkiToUTC(form.registration_ends_at)
      });
      setEvents([...events, res.data.event]);
      setMessage('Event created!');
      setForm({ title: '', description: '', location: '', starts_at: '', ends_at: '', capacity: '', allow_individual_registration: true, registration_starts_at: '', registration_ends_at: '' });
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
          <label>Starts at <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85rem' }}>(Finnish time, EET/EEST)</span></label>
          <input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} required />
          <label>Ends at <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85rem' }}>(Finnish time, EET/EEST)</span></label>
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
          <label>Registration opens at <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85rem' }}>(Finnish time, EET/EEST)</span></label>
          <input type="datetime-local" value={form.registration_starts_at} onChange={e => setForm({ ...form, registration_starts_at: e.target.value })} required />
          <label>Registration closes at <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.85rem' }}>(Finnish time, EET/EEST)</span></label>
          <input type="datetime-local" value={form.registration_ends_at} onChange={e => setForm({ ...form, registration_ends_at: e.target.value })} required />
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
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {formatDate(event.starts_at)} &nbsp;|&nbsp;
              {event.registration_count} registered
              {event.capacity ? ` / ${event.capacity}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to={`/events/${event.id}/registrants`}><button className="btn btn-secondary">Participants</button></Link>
            <button className="btn btn-secondary" onClick={() => openManagers(event)}>Managers</button>
            <Link to={`/events/${event.id}/edit`}><button className="btn btn-secondary">Edit</button></Link>
            {(event.is_owner || user.role === 'admin') && (
              <button className="btn btn-danger" onClick={() => handleDelete(event.id)}>Delete</button>
            )}
          </div>
        </div>
      ))}

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
              padding: '0.5rem 0', borderBottom: '1px solid var(--border)'
            }}>
              <span>
                {m.first_name || m.last_name
                  ? `${m.last_name || ''}, ${m.first_name || ''}`.trim()
                  : m.email}
              </span>
              <button className="btn btn-danger" onClick={() => handleRemoveManager(m.user_id)}>Remove</button>
            </div>
          ))}
          {eventManagers.length === 0 && <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No co-managers yet.</p>}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
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
