import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const [editingTeam, setEditingTeam] = useState(null);
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
  
  const handleSaveTeam = (updated) => {
    setTeams(teams.map(t => t.id === updated.id ? { ...t, ...updated } : t));
    setEditingTeam(null);
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

function EditTeamModal({ team, users, onClose, onSave }) {
  const [form, setForm] = useState({ name: team.name, description: team.description || '', captain_id: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    setError(''); setMessage('');
    try {
      const payload = { name: form.name, description: form.description };
      if (form.captain_id) payload.captain_id = parseInt(form.captain_id);
      const res = await api.put(`/teams/${team.id}`, payload);
      onSave(res.data.team);
      setMessage('Saved!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }}>
      <div className="card" style={{ width: 440, maxWidth: '95vw' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Edit team</h3>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
        <label>Team name</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <label>Description</label>
        <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        <label>Assign new captain (optional)</label>
        <select value={form.captain_id} onChange={e => setForm({ ...form, captain_id: e.target.value })}>
          <option value="">Keep current captain</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%', marginBottom: '1rem' }}>
          Save changes
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

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setTeamError(''); setTeamMessage('');
    try {
      const res = await api.post('/teams', {
        ...teamForm,
        captain_id: parseInt(teamForm.captain_id)
      });
      setTeams([...teams, res.data.team]);
      setTeamMessage('Team created!');
      setTeamForm({ name: '', description: '', captain_id: '' });
    } catch (err) {
      setTeamError(err.response?.data?.error || 'Failed to create team');
    }
  };

  const handleDeleteTeam = async (id, name) => {
    if (!window.confirm(`Delete team "${name}"?`)) return;
    try {
      await api.delete(`/teams/${id}`);
      setTeams(teams.filter(t => t.id !== id));
    } catch (err) {
      setTeamError(err.response?.data?.error || 'Failed to delete team');
    }
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
			  <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Year of birth</th>
			  <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Gender</th>
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
				<td style={{ padding: '0.8rem 1rem' }}>{u.year_of_birth || '—'}</td>
				<td style={{ padding: '0.8rem 1rem' }}>{u.gender || '—'}</td>
                <td style={{ padding: '0.8rem 1rem', color: '#888', fontSize: '0.9rem' }}>
                  {new Date(u.created_at).toLocaleDateString('fi-FI')}
                </td>
                <td style={{ padding: '0.8rem 1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => setEditingUser(u)}>Edit</button>
                    {u.id !== user.id && (
                      <button className="btn btn-danger" onClick={() => handleDelete(u.id, u.name)}>Delete</button>
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

      <h2 style={{ margin: '2rem 0 1rem' }}>Team management</h2>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Create new team</h3>
        {teamError && <p className="error">{teamError}</p>}
        {teamMessage && <p className="success">{teamMessage}</p>}
        <form onSubmit={handleCreateTeam}>
          <label>Team name</label>
          <input
            value={teamForm.name}
            onChange={e => setTeamForm({ ...teamForm, name: e.target.value })}
            required
          />
          <label>Description</label>
          <textarea
            rows={2}
            value={teamForm.description}
            onChange={e => setTeamForm({ ...teamForm, description: e.target.value })}
          />
          <label>Captain</label>
          <select
            value={teamForm.captain_id}
            onChange={e => setTeamForm({ ...teamForm, captain_id: e.target.value })}
            required
          >
            <option value="">Select a captain...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary">Create team</button>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9f9f9', borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Description</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Members</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '0.8rem 1rem' }}><strong>{t.name}</strong></td>
                <td style={{ padding: '0.8rem 1rem', color: '#666' }}>{t.description}</td>
                <td style={{ padding: '0.8rem 1rem' }}>{t.member_count}</td>
                <td style={{ padding: '0.8rem 1rem' }}>
                  <button className="btn btn-danger" onClick={() => handleDeleteTeam(t.id, t.name)}>Delete</button>
				  <button className="btn btn-secondary" onClick={() => setEditingTeam(t)}>Edit</button>
                </td>
              </tr>
            ))}
            {teams.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                  No teams yet
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
	  {editingTeam && (
		<EditTeamModal
		  team={editingTeam}
		  users={users}
		  onClose={() => setEditingTeam(null)}
		  onSave={handleSaveTeam}
		/>
	  )}
    </div>
  );
}