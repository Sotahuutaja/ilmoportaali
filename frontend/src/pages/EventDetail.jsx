import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/events/${id}`).then(res => setEvent(res.data.event));
  }, [id]);

  const register = async () => {
    try {
      await api.post(`/registrations/${id}`);
      setMessage('Successfully registered!');
      setEvent(e => ({ ...e, registration_count: e.registration_count + 1 }));
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  const cancel = async () => {
    try {
      await api.delete(`/registrations/${id}`);
      setMessage('Registration cancelled.');
      setEvent(e => ({ ...e, registration_count: e.registration_count - 1 }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel');
    }
  };

  if (!event) return <p>Loading...</p>;

  const full = event.capacity && event.registration_count >= event.capacity;

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto' }}>
      <div className="card">
        <h2>{event.title}</h2>
        <p style={{ color: '#666', margin: '0.5rem 0' }}>
          📍 {event.location}<br />
          📅 {new Date(event.starts_at).toLocaleString('fi-FI')} —{' '}
          {new Date(event.ends_at).toLocaleString('fi-FI')}
        </p>
        <p style={{ margin: '1rem 0' }}>{event.description}</p>
        <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1rem' }}>
          {event.registration_count} registered
          {event.capacity ? ` / ${event.capacity} spots` : ''}
          {full ? ' — FULL' : ''}
        </p>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        {user ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={register} disabled={full}>
              Register
            </button>
            <button className="btn btn-danger" onClick={cancel}>
              Cancel registration
            </button>
          </div>
        ) : (
          <p>Please <a href="/login">log in</a> to register for this event.</p>
        )}
      </div>
    </div>
  );
}