import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

function EditTeamModal({ team, users, onClose, onSave }) {
  const [form, setForm] = useState({ name: team.name, description: team.description || '', captain_id: '', auto_approve_joins: team.auto_approve_joins || false });
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

  const handleSaveAutoApprove = async () => {
    setError(''); setMessage('');
    try {
      const res = await api.put(`/teams/${team.id}/auto-approve`, { auto_approve_joins: form.auto_approve_joins });
      onSave(res.data.team);
      setMessage(form.auto_approve_joins ? 'Auto-approve enabled!' : 'Auto-approve disabled!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update');
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

        <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />
        <h4 style={{ marginBottom: '1rem' }}>Team settings</h4>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: 0 }}>
          <input
            type="checkbox"
            checked={form.auto_approve_joins}
            onChange={e => setForm({ ...form, auto_approve_joins: e.target.checked })}
            style={{ width: 'auto', margin: 0 }}
          />
          Auto-approve join requests
        </label>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
          {form.auto_approve_joins ? 'New requests are automatically approved' : 'Requests require captain approval'}
        </p>
        <button className="btn btn-primary" onClick={handleSaveAutoApprove} style={{ width: '100%', marginBottom: '1.5rem' }}>
          Save setting
        </button>

        <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />
        <h4 style={{ marginBottom: '1rem' }}>Current captains</h4>
        {captains.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>No captains assigned.</p>}
        {captains.map(m => (
          <div key={m.user_id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.5rem 0', borderBottom: '1px solid var(--border)'
          }}>
            <span>{m.first_name || m.last_name ? `${m.last_name || ''}, ${m.first_name || ''}`.trim() : m.email}</span>
            <button className="btn btn-danger" onClick={() => handleDemote(m.user_id)}>
              Remove captain
            </button>
          </div>
        ))}

        <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid var(--border)' }} />
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

export default function AdminTeams() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [editingTeam, setEditingTeam] = useState(null);
  const [teamForm, setTeamForm] = useState({ name: '', description: '', captain_id: '', auto_approve_joins: false });
  const [teamMessage, setTeamMessage] = useState('');
  const [teamError, setTeamError] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
    api.get('/users').then(res => setUsers(res.data.users));
    api.get('/teams').then(res => setTeams(res.data.teams));
  }, [user, navigate]);

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
      setTeamForm({ name: '', description: '', captain_id: '', auto_approve_joins: false });
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

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Link to="/admin" style={{ marginBottom: '1rem', display: 'inline-block', color: 'var(--accent)', textDecoration: 'none' }}>
        ← Back to Admin
      </Link>

      <h2>Team Management</h2>

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
            {users.map(u => {
              const name = u.first_name || u.last_name ? `${u.last_name || ''}, ${u.first_name || ''}`.trim() : u.name || u.email;
              return <option key={u.id} value={u.id}>{name} ({u.email})</option>;
            })}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={teamForm.auto_approve_joins}
              onChange={e => setTeamForm({ ...teamForm, auto_approve_joins: e.target.checked })}
              style={{ width: 'auto', margin: 0 }}
            />
            Auto-approve join requests
          </label>
          <button type="submit" className="btn btn-primary">Create team</button>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto', marginTop: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Description</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Members</th>
              <th style={{ padding: '0.8rem 1rem', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.8rem 1rem' }}><strong>{t.name}</strong></td>
                <td style={{ padding: '0.8rem 1rem', color: 'var(--text-muted)' }}>{t.description}</td>
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
                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No teams yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
