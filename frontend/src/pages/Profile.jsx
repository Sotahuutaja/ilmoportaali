import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { formatDate } from '../utils/datetime';

const currentYear = new Date().getFullYear();

export default function Profile() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', year_of_birth: '', gender: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [registrations, setRegistrations] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [editing, setEditing] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email
      };
      if (form.year_of_birth) payload.year_of_birth = parseInt(form.year_of_birth);
      if (form.gender) payload.gender = form.gender;

      const res = await api.put('/auth/profile', payload);
      // Token is in httpOnly cookie, just update user data
      login(res.data.user);
      setMessage('Profile updated!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    }
  };

  const handlePasswordReset = async () => {
    setResetMessage(''); setResetError('');
    try {
      const res = await api.post('/auth/forgot-password', { email: user.email });
      setResetMessage(res.data.message);
    } catch (err) {
      setResetError(err.response?.data?.error || 'Failed to send reset email');
    }
  };

  useEffect(() => {
    if (!user) { navigate('/login'); return; }

    setForm(f => ({
      ...f,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email,
      year_of_birth: user.year_of_birth || '',
      gender: user.gender || ''
    }));

    Promise.all([
      api.get('/registrations/my/list'),
      api.get('/teams/my/memberships')
    ]).then(([regRes, teamRes]) => {
      setRegistrations(regRes.data.registrations);
      setMyTeams(teamRes.data.teams);
    }).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>My profile</h2>

      {/* Account settings */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Account settings</h3>
          {!editing && (
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        {!editing ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.2rem' }}>First name</p>
                <p><strong>{user.first_name || '—'}</strong></p>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.2rem' }}>Last name</p>
                <p><strong>{user.last_name || '—'}</strong></p>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.2rem' }}>Email</p>
                <p><strong>{user.email}</strong></p>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.2rem' }}>Year of birth</p>
                <p><strong>{user.year_of_birth || '—'}</strong></p>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.2rem' }}>Gender</p>
                <p><strong>{user.gender || '—'}</strong></p>
              </div>
            </div>
            <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />
            <h4 style={{ marginBottom: '0.5rem' }}>Password</h4>
            {resetMessage && <p className="success">{resetMessage}</p>}
            {resetError && <p className="error">{resetError}</p>}
            <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={handlePasswordReset}>
              Send password reset email
            </button>
          </div>
        ) : (
          <form onSubmit={async (e) => { await handleSave(e); setEditing(false); }}>
            <label>First name</label>
            <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required />
            <label>Last name</label>
            <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} required />
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            <label>Year of birth</label>
            <input
              type="number" min="1940" max={currentYear}
              value={form.year_of_birth}
              onChange={e => setForm({ ...form, year_of_birth: e.target.value })}
              placeholder={`1940 – ${currentYear}`}
            />
            <label>Gender</label>
            <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
              <option value="">Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary">Save changes</button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* Team memberships */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>My teams</h3>
        {loading && <p style={{ color: 'var(--text-muted)' }}>Loading...</p>}
        {!loading && myTeams.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>
            You are not a member of any team. <Link to="/teams">Browse teams</Link>
          </p>
        )}
        {myTeams.map(t => (
          <div key={t.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.6rem 0', borderBottom: '1px solid var(--border)'
          }}>
            <div>
              <strong>{t.name}</strong>
              <span style={{
                marginLeft: '0.5rem', fontSize: '0.8rem', padding: '0.2rem 0.5rem',
                borderRadius: '12px',
                background: t.role === 'captain' ? '#1a1a2e' : '#8e44ad',
                color: 'white'
              }}>{t.role}</span>
              <span style={{
                marginLeft: '0.4rem', fontSize: '0.8rem', padding: '0.2rem 0.5rem',
                borderRadius: '12px',
                background: t.status === 'approved' ? '#27ae60' : '#e67e22',
                color: 'white'
              }}>{t.status}</span>
            </div>
            <Link to="/teams">
              <button className="btn btn-secondary">View</button>
            </Link>
          </div>
        ))}
      </div>

      {/* Registered events */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>My registrations</h3>
        {loading && <p style={{ color: 'var(--text-muted)' }}>Loading...</p>}
        {!loading && registrations.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>
            You have not registered for any events. <Link to="/">Browse events</Link>
          </p>
        )}
        {registrations.map(r => (
          <div key={r.id} style={{ padding: '0.8rem 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <strong>{r.title}</strong>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.2rem 0' }}>
                  📍 {r.location} &nbsp;|&nbsp;
                  📅 {formatDate(r.starts_at, { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                {r.team_name && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Team: {r.team_name}</p>
                )}
                {r.products && r.products.length > 0 && (
                  <div style={{ marginTop: '0.3rem' }}>
                    {r.products.map((p, i) => (
                      <span key={i} style={{
                        display: 'inline-block', marginRight: '0.4rem',
                        fontSize: '0.8rem', padding: '0.1rem 0.5rem',
                        borderRadius: '8px', background: 'var(--surface-3)', color: 'var(--text)'
                      }}>
                        {p.name} x{p.quantity}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Link to={`/events/${r.id}`}>
                <button className="btn btn-secondary">View event</button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
