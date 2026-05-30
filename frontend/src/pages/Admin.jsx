import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const ROLES = ['attendee', 'creator', 'admin'];

function EditUserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({ first_name: user.first_name, last_name: user.last_name, email: user.email, role: user.role });
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
        <label>First name</label>
    <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
    <label>Last name</label>
    <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
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
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get(`/teams/${team.id}`).then(res => setMembers(res.data.members));
  }, [team.id]);

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

  const handleDemote = async (userId) => {
    setError(''); setMessage('');
    try {
      await api.put(`/teams/${team.id}/members/${userId}`, { status: 'approved', role: 'member' });
      setMembers(members.map(m => m.user_id === userId ? { ...m, role: 'member' } : m));
      setMessage('Captain demoted to member.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to demote');
    }
  };

  const captains = members.filter(m => m.role === 'captain' && m.status === 'approved');

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }}>
      <div className="card" style={{ width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Edit team</h3>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <label>Team name</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <label>Description</label>
        <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />

        <button className="btn btn-primary" onClick={handleSave} style={{ width: '100%', marginBottom: '1.5rem' }}>
          Save changes
        </button>

        <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid #eee' }} />
        <h4 style={{ marginBottom: '1rem' }}>Current captains</h4>
        {captains.length === 0 && <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1rem' }}>No captains assigned.</p>}
        {captains.map(m => (
          <div key={m.user_id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.5rem 0', borderBottom: '1px solid #f0f0f0'
          }}>
            <span>{m.first_name || m.last_name ? `${m.last_name || ''}, ${m.first_name || ''}`.trim() : m.email}</span>
            <button className="btn btn-danger" onClick={() => handleDemote(m.user_id)}>
              Remove captain
            </button>
          </div>
        ))}

        <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid #eee' }} />
        <h4 style={{ marginBottom: '0.5rem' }}>Assign new captain</h4>
        <select value={form.captain_id} onChange={e => setForm({ ...form, captain_id: e.target.value })}>
          <option value="">Select a user...</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>
              {u.first_name || u.last_name ? `${u.last_name || ''}, ${u.first_name || ''}` : u.email}
            </option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!form.captain_id}
          style={{ width: '100%', marginBottom: '1rem' }}
        >
          Assign captain
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
  const [editingTeam, setEditingTeam] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ first_name: '', last_name: '', email: '', role: '', year_of_birth: '', gender: '' });
  const [teamForm, setTeamForm] = useState({ name: '', description: '', captain_id: '' });
  const [teamMessage, setTeamMessage] = useState('');
  const [teamError, setTeamError] = useState('');
  const [showUsers, setShowUsers] = useState(true);
  const [showTeams, setShowTeams] = useState(true);
  const [sortField, setSortField] = useState('last_name');
  const [sortDir, setSortDir] = useState('asc');

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

  const handleSaveTeam = (updated) => {
    setTeams(teams.map(t => t.id === updated.id ? { ...t, ...updated } : t));
    setEditingTeam(null);
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
  
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };
  
  const getSortValue = (u, field) => {
    switch (field) {
      case 'first_name': return u.first_name || u.email || '';
      case 'last_name': return u.last_name || u.email || '';
      case 'email': return u.email || '';
      case 'role': return u.role || '';
      case 'age': return u.year_of_birth ? new Date().getFullYear() - u.year_of_birth : 0;
      case 'gender': return u.gender || '';
      case 'created_at': return u.created_at || '';
      default: return '';
    }
  };
  
  const exportUsersCSV = () => {
    const headers = ['First name', 'Last name', 'Email', 'Role', 'Age', 'Gender', 'Joined'];
    const currentYear = new Date().getFullYear();
    const rows = users.map(u => [
    u.first_name || '',
    u.last_name || '',
    u.email,
    u.role,
    u.year_of_birth ? currentYear - u.year_of_birth : '',
    u.gender || '',
    new Date(u.created_at).toLocaleDateString('fi-FI')
  ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  const roleColor = (role) => ({
    admin: '#1a1a2e',
    creator: '#8e44ad',
    attendee: '#27ae60'
  }[role] || '#888');

  const filtered = users.filter(u =>
    (!filters.first_name || (u.first_name || '').toLowerCase().includes(filters.first_name.toLowerCase())) &&
    (!filters.last_name || (u.last_name || '').toLowerCase().includes(filters.last_name.toLowerCase())) &&
    (!filters.email || u.email.toLowerCase().includes(filters.email.toLowerCase())) &&
    (!filters.role || u.role === filters.role) &&
    (!filters.year_of_birth || String(u.year_of_birth).includes(filters.year_of_birth)) &&
    (!filters.gender || u.gender === filters.gender)
  )
  .sort((a, b) => {
    const valA = getSortValue(a, sortField);
    const valB = getSortValue(b, sortField);
    if (typeof valA === 'number') return sortDir === 'asc' ? valA - valB : valB - valA;
    return sortDir === 'asc'
      ? valA.localeCompare(valB, 'fi')
      : valB.localeCompare(valA, 'fi');
  });
  
  const calculateAge = (yearOfBirth) => {
  if (!yearOfBirth) return '—';
  return new Date().getFullYear() - yearOfBirth;
  };
  
  return (
    <div>
      {/* User management */}
      <div
    onClick={() => setShowUsers(v => !v)}
    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1.5rem 0', cursor: 'pointer', userSelect: 'none' }}
    >
    <h2>User management</h2>
    <span style={{ fontSize: '1rem', color: '#888', transition: 'transform 0.2s', display: 'inline-block', transform: showUsers ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
    <button
      className="btn btn-secondary"
      onClick={e => { e.stopPropagation(); exportUsersCSV(); }}
      style={{ marginLeft: 'auto' }}
    >
      Export CSV
    </button>
    </div>
      {error && <p className="error">{error}</p>}

      {showUsers && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
        <div>
          <label>First name</label>
          <input
          placeholder="Filter..."
          value={filters.first_name}
          onChange={e => setFilters({ ...filters, first_name: e.target.value })}
          style={{ marginBottom: 0 }}
          />
        </div>
        <div>
          <label>Last name</label>
          <input
          placeholder="Filter..."
          value={filters.last_name}
          onChange={e => setFilters({ ...filters, last_name: e.target.value })}
          style={{ marginBottom: 0 }}
          />
        </div>
        <div>
          <label>Email</label>
          <input
          placeholder="Filter..."
          value={filters.email}
          onChange={e => setFilters({ ...filters, email: e.target.value })}
          style={{ marginBottom: 0 }}
          />
        </div>
        <div>
          <label>Role</label>
          <select
          value={filters.role}
          onChange={e => setFilters({ ...filters, role: e.target.value })}
          style={{ marginBottom: 0 }}
          >
          <option value="">All</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label>Age</label>
          <input
          placeholder="Filter by age..."
          value={filters.year_of_birth}
          onChange={e => setFilters({ ...filters, year_of_birth: e.target.value })}
          style={{ marginBottom: 0 }}
          />
        </div>
        <div>
          <label>Gender</label>
          <select
          value={filters.gender}
          onChange={e => setFilters({ ...filters, gender: e.target.value })}
          style={{ marginBottom: 0 }}
          >
          <option value="">All</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
          </select>
        </div>
        </div>
        {Object.values(filters).some(v => v) && (
        <button
          className="btn btn-secondary"
          onClick={() => setFilters({ first_name: '', last_name: '', email: '', role: '', year_of_birth: '', gender: '' })}
          style={{ marginTop: '0.5rem' }}
        >
          Clear filters
        </button>
        )}
      </div>

          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9f9f9', borderBottom: '1px solid #eee' }}>
          {[
            { label: 'First name', field: 'first_name' },
            { label: 'Last name', field: 'last_name' },
            { label: 'Email', field: 'email' },
            { label: 'Role', field: 'role' },
            { label: 'Age', field: 'age' },
            { label: 'Gender', field: 'gender' },
            { label: 'Joined', field: 'created_at' },
          ].map(({ label, field }) => (
            <th
            key={field}
            onClick={() => handleSort(field)}
            style={{
              padding: '0.8rem 1rem', textAlign: 'left',
              cursor: 'pointer', userSelect: 'none',
              whiteSpace: 'nowrap'
            }}
            >
            {label}
            <span style={{ marginLeft: '0.3rem', color: '#aaa' }}>
              {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
            </span>
            </th>
          ))}
          <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Actions</th>
          </tr>
        </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.8rem 1rem' }}>{u.first_name}</td>
          <td style={{ padding: '0.8rem 1rem' }}>{u.last_name}</td>
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
                    <td style={{ padding: '0.8rem 1rem' }}>{calculateAge(u.year_of_birth)}</td>
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
                    <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Team management */}
      <div
    onClick={() => setShowTeams(v => !v)}
    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '2rem 0 1rem', cursor: 'pointer', userSelect: 'none' }}
    >
    <h2>Team management</h2>
    <span style={{ fontSize: '1rem', color: '#888', transition: 'transform 0.2s', display: 'inline-block', transform: showTeams ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
    </div>

      {showTeams && (
        <>
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
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" onClick={() => setEditingTeam(t)}>Edit</button>
                        <button className="btn btn-danger" onClick={() => handleDeleteTeam(t.id, t.name)}>Delete</button>
                      </div>
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
        </>
      )}

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