import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/events')
      .then(res => setEvents(res.data.events))
      .catch(() => setError('Failed to load events'));
  }, []);

  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h2 style={{ margin: '1.5rem 0' }}>Upcoming Events</h2>
      {events.length === 0 && <p>No events yet.</p>}
      {events.map(event => (
        <div className="card" key={event.id}>
          <h3>{event.title}</h3>
          <p style={{ color: '#666', margin: '0.3rem 0' }}>
            📍 {event.location} &nbsp;|&nbsp;
            📅 {new Date(event.starts_at).toLocaleDateString('fi-FI', {
              day: 'numeric', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            })}
          </p>
          <p style={{ margin: '0.5rem 0' }}>{event.description}</p>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>
            {event.registration_count} registered
            {event.capacity ? ` / ${event.capacity} capacity` : ''}
          </p>
          <Link to={`/events/${event.id}`}>
            <button className="btn btn-primary" style={{ marginTop: '0.8rem' }}>
              View event
            </button>
          </Link>
        </div>
      ))}
    </div>
  );
}