import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { formatDateTime } from '../utils/datetime';

function EventCard({ event }) {
  return (
    <div className="card" key={event.id}>
      <h3>{event.title}</h3>
      <p style={{ color: 'var(--text-muted)', margin: '0.3rem 0' }}>
        📍 {event.location} &nbsp;|&nbsp;
        📅 {formatDateTime(event.starts_at, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>
      <p style={{ margin: '0.5rem 0' }}>{event.description}</p>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
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
    .sort((a, 