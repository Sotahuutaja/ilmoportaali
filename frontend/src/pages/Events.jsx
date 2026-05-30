import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

function EventCard({ event }) {
  return (
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
  );
}

export default function Events() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    api.get('/events')
      .then(res => setEvents(res.data.events))
      .catch(() => setError('Failed to load events'));
  }, []);

  if (error) return <p className="error">{error}</p>;

  const now = new Date();
  const upcoming = events.filter(e => new Date(e.ends_at) >= now);
  const past = events.filter(e => new Date(e.ends_at) < now)
    .sort((a, b) => new Date(b.ends_at) - new Date(a.ends_at)); // most recent first

  return (
    <div>
      <h2 style={{ margin: '1.5rem 0' }}>Upcoming Events</h2>
      {upcoming.length === 0 && <p style={{ color: '#888' }}>No upcoming events.</p>}
      {upcoming.map(event => <EventCard key={event.id} event={event} />)}

      {past.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div
            onClick={() => setShowPast(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none', marginBottom: '1rem' }}
          >
            <h2>Past Events</h2>
            <span style={{
              fontSize: '1rem', color: '#888', display: 'inline-block',
              transition: 'transform 0.2s',
              transform: showPast ? 'rotate(0deg)' : 'rotate(-90deg)'
            }}>▼</span>
            <span style={{ color: '#888', fontSize: '0.9rem' }}>({past.length})</span>
          </div>
          {showPast && past.map(event => <EventCard key={event.id} event={event} />)}
        </div>
      )}
    </div>
  );
}
