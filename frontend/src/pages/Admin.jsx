import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const ROLES = ['attendee', 'creator', 'admin'];

function EditUserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({ name: user.name, email: user.email, role: user.role });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    setError(''); setMessage('');
    try {
      const res = await api.put(`/users/${user.id}`, form);
      onSave(res.data.user);
      setMessage('Saved!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  };

  const handlePasswordReset = async () => {
    setError(''); setMessage('');
    if (!password) return setError('Enter a new password');
    try {
      await api.put(`/users/${user.id}/password`, { password });
      setMessage('Password updated!');
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }}>
      <div className="card" style={{ width: 440, maxWidth: '95vw' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Edit user</h3>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <label>Name</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <label>Email</label>
        <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <label>Role</label>
        <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%', marginBottom: '1rem' }}>
          Save changes
        </button>

        <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid #eee' }} />
        <h4 style={{ marginBottom: '0.5rem' }}>Reset password</h4>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button className="btn btn-secondary" onClick={handlePasswordReset} style={{ width: '100%', marginBottom: '1rem' }}>
          Update password
        </button>

        <button className="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>
          Close
        </button>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Team form
  const [teamForm, setTeamForm] = useState({ name: '', description: '', captain_id: '' });
  const [teamMessage, setTeamMessage] = useState('');
  const [teamError, setTeamError] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
    api.get('/users').then(res => setUsers(res.data.users));
    api.get('/teams').then(res => setTeams(res.data.teams));
  }, [user]);

  const handleDele