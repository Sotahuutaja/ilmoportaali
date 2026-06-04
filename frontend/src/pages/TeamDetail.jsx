import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import { fullName } from '../AuthContext';

export default function TeamDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [myTeams, setMyTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionText, setDescriptionText] = useState('');

  useEffect(() => {
    const loadTeam = async () => {
      try {
        const teamRes = await api.get(`/teams/${id}`);
        setTeam(teamRes.data.team);
        setMembers(teamRes.data.members);
        setAutoApprove(teamRes.data.team.auto_approve_joins || false);
        setDescriptionText(teamRes.data.team.description || '');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load team');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      api.get('/teams/my/memberships').then(res => setMyTeams(res.data.teams));
    }

    loadTeam();
  }, [id, user]);

  const isCaptain = team && myTeams.some(t => t.id === team.id && t.role === 'captain' && t.status === 'approved');

  const handleApprove = async (userId) => {
    try {
      await api.put(`/teams/${id}/approve/${userId}`);
      const res = await api.get(`/teams/${id}`);
      setMembers(res.data.members);
      setMessage('Member approved!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve');
    }
  };

  const handleReject = async (userId) => {
    try {
      await api.delete(`/teams/${id}/reject/${userId}`);
      const res = await api.get(`/teams/${id}`);
      setMembers(res.data.members);
      setMessage('Member rejected.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject');
    }
  };

  const handleRemove = async (userId) => {
    if (!window.confirm('Remove this member?')) return;
    try {
      await api.delete(`/teams/${id}/members/${userId}`);
      setMembers(members.filter(m => m.user_id !== userId));
      setMessage('Member removed.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove');
    }
  };

  const handleMakeCaptain = async (userId, firstName, lastName, email) => {
    const name = fullName({ first_name: firstName, last_name: lastName, email: email });
    if (!window.confirm(`Make ${name} the new captain? You will become a regular member.`)) return;
    try {
      await api.put(`/teams/${id}/captain`, { user_id: userId });
      setMessage(`${name} is now the captain!`);
      const res = await api.get(`/teams/${id}`);
      setMembers(res.data.members);
      const myRes = await api.get('/teams/my/memberships');
      setMyTeams(myRes.data.teams);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to transfer captaincy');
    }
  };

  const handleToggleAutoApprove = async () => {
    try {
      const newValue = !autoApprove;
      const res = await api.put(`/teams/${id}/auto-approve`, { auto_approve_joins: newValue });
      setAutoApprove(newValue);
      setTeam(res.data.team);
      setMessage(newValue ? 'Auto-approve enabled!' : 'Auto-approve disabled!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update setting');
    }
  };

  const handleSaveDescription = async () => {
    try {
      const res = await api.put(`/teams/${id}/description`, { description: descriptionText });
      setTeam(res.data.team);
      setEditingDescription(false);
      setMessage('Description updated!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update description');
    }
  };

  const handleCancelEditDescription = () => {
    setDescriptionText(team.description || '');
    setEditingDescription(false);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: '2rem auto' }}>
        <div className="card">
          <p>Loading team...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div style={{ maxWidth: 640, margin: '2rem auto' }}>
        <div className="card">
          <p className="error">Team not found</p>
          <button onClick={() => navigate('/teams')} className="btn btn-secondary">
            Back to teams
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.5rem 0' }}>
        <h2>{team.name}</h2>
        <button className="btn btn-secondary" onClick={() => navigate('/teams')}>
          Back to teams
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      {(editingDescription || team.description) && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          {editingDescription ? (
            <div>
              <label>Team Description</label>
              <textarea
                value={descriptionText}
                onChange={e => setDescriptionText(e.target.value)}
                placeholder="Enter team description..."
                rows={3}
                style={{ marginBottom: '0.5rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={handleSaveDescription} style={{ flex: 1 }}>
                  Save
                </button>
                <button className="btn btn-secondary" onClick={handleCancelEditDescription} style={{ flex: 1 }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)', flex: 1 }}>{team.description || 'No description'}</p>
              {(isCaptain || user?.role === 'admin') && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setEditingDescription(true)}
                  style={{ marginLeft: '0.5rem', flexShrink: 0 }}
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {(isCaptain || user?.role === 'admin') && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Team Settings</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={handleToggleAutoApprove}
              style={{ width: 'auto', margin: 0 }}
            />
            Auto-approve join requests
          </label>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            {autoApprove ? 'New requests are automatically approved' : 'Requests require your approval'}
          </p>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Members ({members?.length || 0})</h3>
        {members === null ? (
          <p style={{ color: 'var(--text-muted)' }}>You must be a member of this team to see its members.</p>
        ) : members.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No members yet.</p>
        ) : (
          members.map((member) => (
            <div key={member.user_id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.6rem 0', borderBottom: '1px solid var(--border)'
            }}>
              <div>
                <strong>{fullName({ first_name: member.first_name, last_name: member.last_name, email: member.email })}</strong>
                <span style={{
                  marginLeft: '0.5rem', fontSize: '0.8rem', padding: '0.2rem 0.5rem',
                  borderRadius: '12px',
                  background: member.role === 'captain' ? '#1a1a2e' : '#8e44ad',
                  color: 'white'
                }}>{member.role}</span>
                {member.status === 'pending' && (
                  <span style={{
                    marginLeft: '0.5rem', fontSize: '0.8rem', padding: '0.2rem 0.5rem',
                    borderRadius: '12px', background: '#e67e22', color: 'white'
                  }}>pending</span>
                )}
              </div>
              {(isCaptain || user?.role === 'admin') && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {member.status === 'pending' && (
                    <>
                      <button className="btn btn-primary" onClick={() => handleApprove(member.user_id)}>
                        Approve
                      </button>
                      <button className="btn btn-danger" onClick={() => handleReject(member.user_id)}>
                        Reject
                      </button>
                    </>
                  )}
                  {member.status === 'approved' && member.role !== 'captain' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {isCaptain && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleMakeCaptain(member.user_id, member.first_name, member.last_name, member.email)}
                        >
                          Make captain
                        </button>
                      )}
                      <button className="btn btn-danger" onClick={() => handleRemove(member.user_id)}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
