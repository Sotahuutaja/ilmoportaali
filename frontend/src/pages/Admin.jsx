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
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
    api.get('/users')
      .then(res => setUsers(res.data.users))
      .catch(() => setError('Failed to load users'));
  }, [user]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${id}`);
      setUsers(users.filter(u => u.id !== id));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleSave = (updated) => {
    setUsers(users.map(u => u.id === updated.id ? { ...u, ...updated } : u));
  };

  const roleColor = (role) => ({
    admin: '#1a1a2e',
    creator: '#8e44ad',
    attendee: '#27ae60'
  }[role] || '#888');

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h2 style={{ margin: '1.5rem 0' }}>User management</h2>
      {error && <p className="error">{error}</p>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <input
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 0 }}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9f9f9', borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Role</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Joined</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '0.8rem 1rem' }}>{u.name}</td>
                <td style={{ padding: '0.8rem 1rem', color: '#666' }}>{u.email}</td>
                <td style={{ padding: '0.8rem 1rem' }}>
                  <span style={{
                    background: roleColor(u.role),
                    color: 'white',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.8rem'
                  }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: '0.8rem 1rem', color: '#888', fontSize: '0.9rem' }}>
                  {new Date(u.created_at).toLocaleDateString('fi-FI')}
                </td>
                <td style={{ padding: '0.8rem 1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => setEditingUser(u)}>
                      Edit
                    </button>
                    {u.id !== user.id && (
                      <button className="btn btn-danger" onClick={() => handleDelete(u.id, u.name)}>
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={(updated) => { handleSave(updated); setEditingUser(null); }}
        />
      )}
    </div>
  );
}