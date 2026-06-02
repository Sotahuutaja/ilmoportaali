import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import api from '../api';
import { fullName } from '../AuthContext';

export default function Teams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [selected, setSelected] = useState(null);
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);

  useEffect(() => {
    api.get('/teams').then(res => setTeams(res.data.teams));
    if (user) {
      api.get('/teams/my/memberships').then(res => setMyTeams(res.data.teams));
    }
  }, [user]);

  const selectTeam = async (team) => {
    setSelected(team);
    setMessage(''); setError('');
    setAutoApprove(team.auto_approve_joins || false);
    const isMember = myTeams.some(t => t.id === team.id && t.status === 'approved');
    const isAdmin = user?.role === 'admin';
    if (isMember || isAdmin) {
      const res = await api.get(`/teams/${team.id}`);
      setMembers(res.data.members);
    } else {
      setMembers(null);
    }
  };

  const requestJoin = async (teamId) => {
    try {
      await api.post(`/teams/${teamId}/request`);
      setMessage('Join request sent!');
      const res = await api.get('/teams/my/memberships');
      setMyTeams(res.data.teams);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send request');
    }
  };

  const refreshTeamCount = async (teamId) => {
    const res = await api.get(`/teams/${teamId}`).catch(() => null);
    if (res) {
      const approvedCount = res.data.members.filter(m => m.status === 'approved').length;
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, member_count: approvedCount } : t));
    }
  };

  const handleApprove = async (teamId, userId) => {
    try {
      await api.put(`/teams/${teamId}/approve/${userId}`);
      const res = await api.get(`/teams/${teamId}`);
      setMembers(res.data.members);
      refreshTeamCount(teamId);
      setMessage('Member approved!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve');
    }
  };

  const handleReject = async (teamId, userId) => {
    try {
      await api.delete(`/teams/${teamId}/reject/${userId}`);
      const res = await api.get(`/teams/${teamId}`);
      setMembers(res.data.members);
      refreshTeamCount(teamId);
      setMessage('Member rejected.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject');
    }
  };

  const handleRemove = async (teamId, userId) => {
    if (!window.confirm('Remove this member?')) return;
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`);
      setMembers(members.filter(m => m.user_id !== userId));
      refreshTeamCount(teamId);
      setMessage('Member removed.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove');
    }
  };

  const handleMakeCaptain = async (teamId, userId, firstName, lastName, email) => {
    const name = fullName({ first_name: firstName, last_name: lastName, email: email });
    if (!window.confirm(`Make ${name} the new captain? You will become a regular member.`)) return;
    try {
      await api.put(`/teams/${teamId}/captain`, { user_id: userId });
      setMessage(`${name} is now the captain!`);
      const res = await api.get(`/teams/${teamId}`);
      setMembers(res.data.members);
      const myRes = await api.get('/teams/my/memberships');
      setMyTeams(myRes.data.teams);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to transfer captaincy');
    }
  };
  
  const handleLeave = async (teamId, teamName) => {
    if (!window.confirm(`Leave team "${teamName}"?`)) return;
    try {
      await api.delete(`/teams/${teamId}/members/${user.id}`);
      setMyTeams(myTeams.filter(t => t.id !== teamId));
      setTeams(teams.map(t => t.id === teamId ? { ...t, member_count: t.member_count - 1 } : t));
      if (selected?.id === teamId) { setSelected(null); setMembers(null); }
      setMessage('You have left the team.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to leave team');
    }
  };

  const handleToggleAutoApprove = async (teamId) => {
    try {
      const newValue = !autoApprove;
      const res = await api.put(`/teams/${teamId}/auto-approve`, { auto_approve_joins: newValue });
      setAutoApprove(newValue);
      setSelected(res.data.team);
      setMessage(newValue ? 'Auto-approve enabled!' : 'Auto-approve disabled!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update setting');
    }
  };

  const isCaptain = (teamId) =>
    myTeams.some(t => t.id === teamId && t.role === 'captain' && t.status === 'approved');

  const myStatusInTeam = (teamId) => myTeams.find(t => t.id === teamId);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
      <div>
        <h2 style={{ margin: '1.5rem 0' }}>Teams</h2>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        {myTeams.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>My teams</h3>
            {myTeams.map(t => (
        <div className="card" key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>{t.name}</strong>
          <span style={{
          marginLeft: '0.5rem', fontSize: '0.8rem', padding: '0.2rem 0.5rem',
          borderRadius: '12px',
          background: t.status === 'approved' ? '#27ae60' : '#e67e22',
          color: 'white'
          }}>{t.role} · {t.status}</span>
        </div>
        <button className="btn btn-danger" onClick={() => handleLeave(t.id, t.name)}>
          Leave
        </button>
        </div>
      ))}
          </div>
        )}

        <h3 style={{ marginBottom: '0.5rem' }}>Other teams</h3>
        {teams.filter(team => !myStatusInTeam(team.id)).map(team => {
          const myStatus = myStatusInTeam(team.id);
          const joinButtonText = team.auto_approve_joins ? 'Join' : 'Request to join';
          return (
            <div className="card" key={team.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong>{team.name}</strong>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.3rem 0' }}>{team.description}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{team.member_count} members</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button className="btn btn-secondary" onClick={() => selectTeam(team)}>View</button>
                  {user && !myStatus && (
                    <button
                      className="btn"
                      onClick={() => requestJoin(team.id)}
                      style={{
                        background: team.auto_approve_joins ? '#27ae60' : '#f39c12',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontWeight: '500'
                      }}
                    >
                      {joinButtonText}
                    </button>
                  )}
                  {myStatus && (
                    <span style={{
                      padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem',
                      background: myStatus.status === 'approved' ? '#27ae60' : '#e67e22',
                      color: 'white'
                    }}>
                      {myStatus.status === 'approved' ? myStatus.role : 'pending'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {teams.filter(team => !myStatusInTeam(team.id)).length === 0 && <p style={{ color: 'var(--text-muted)' }}>No other teams available.</p>}
      </div>

      {selected && (
        <div key={selected.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.5rem 0' }}>
            <h3>{selected.name}</h3>
            <button className="btn btn-secondary" onClick={() => { setSelected(null); setMembers(null); }}>Close</button>
          </div>

          {(isCaptain(selected.id) || user?.role === 'admin') && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Team Settings</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={autoApprove}
                  onChange={() => handleToggleAutoApprove(selected.id)}
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
            <h3 style={{ marginBottom: '1rem' }}>Members</h3>
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
                  {(isCaptain(selected.id) || user?.role === 'admin') && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {member.status === 'pending' && (
                        <>
                          <button className="btn btn-primary" onClick={() => handleApprove(selected.id, member.user_id)}>
                            Approve
                          </button>
                          <button className="btn btn-danger" onClick={() => handleReject(selected.id, member.user_id)}>
                            Reject
                          </button>
                        </>
                      )}
                      {member.status === 'approved' && member.role !== 'captain' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {isCaptain(selected.id) && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleMakeCaptain(selected.id, member.user_id, member.first_name, member.last_name, member.email)}
                            >
                              Make captain
                            </button>
                          )}
                          <button className="btn btn-danger" onClick={() => handleRemove(selected.id, member.user_id)}>
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
      )}
    </div>
  );
}