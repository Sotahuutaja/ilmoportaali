import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import { fullName } from '../AuthContext';

export default function Teams() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    api.get('/teams').then(res => setTeams(res.data.teams));
    if (user) {
      api.get('/teams/my/memberships').then(res => setMyTeams(res.data.teams));
    }
  }, [user]);

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

  const handleLeave = async (teamId, teamName) => {
    if (!window.confirm(`Leave team "${teamName}"?`)) return;
    try {
      await api.delete(`/teams/${teamId}/members/${user.id}`);
      setMyTeams(myTeams.filter(t => t.id !== teamId));
      setTeams(teams.map(t => t.id === teamId ? { ...t, member_count: t.member_count - 1 } : t));
      setMessage('You have left the team.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to leave team');
    }
  };

  const myStatusInTeam = (teamId) => myTeams.find(t => t.id === teamId);

  const filterTeams = (teamsToFilter) => {
    if (!searchQuery.trim()) return teamsToFilter;
    const query = searchQuery.toLowerCase();
    return teamsToFilter.filter(t =>
      t.name.toLowerCase().includes(query) ||
      (t.description && t.description.toLowerCase().includes(query))
    );
  };

  const filteredMyTeams = filterTeams(myTeams);
  const filteredOtherTeams = filterTeams(teams.filter(team => !myStatusInTeam(team.id)));

  return (
    <div>
      <h2 style={{ margin: '1.5rem 0' }}>Teams</h2>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search teams by name or description..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div>

        {filteredMyTeams.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>My teams</h3>
            {filteredMyTeams.map(t => (
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate(`/teams/${t.id}`)}>View</button>
          <button className="btn btn-danger" onClick={() => handleLeave(t.id, t.name)}>
            Leave
          </button>
        </div>
        </div>
      ))}
          </div>
        )}

        <h3 style={{ marginBottom: '0.5rem' }}>Other teams</h3>
        {filteredOtherTeams.map(team => {
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
                  <button className="btn btn-secondary" onClick={() => navigate(`/teams/${team.id}`)}>View</button>
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

        {filteredOtherTeams.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>
            {teams.filter(team => !myStatusInTeam(team.id)).length === 0 ? 'No other teams available.' : 'No teams match your search.'}
          </p>
        )}
      </div>
    </div>
  );
}