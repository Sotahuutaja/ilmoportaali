import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

const LEVEL_COLORS = {
  error: '#c0392b',
  warning: '#f39c12',
  info: '#3498db',
  success: '#27ae60'
};

const LEVEL_ICONS = {
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  success: '✓'
};

export default function AdminLogs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [categories, setCategories] = useState({});
  const [levels, setLevels] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
  }, [user, navigate]);

  const fetchLogs = async () => {
    try {
      setError('');
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedLevel) params.append('level', selectedLevel);
      if (searchTerm) params.append('search', searchTerm);
      params.append('limit', 200);

      const response = await api.get(`/logs?${params.toString()}`);
      setLogs(response.data.logs);
      setCategories(response.data.categories);
      setLevels(response.data.levels);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedCategory, selectedLevel, searchTerm]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRefresh, selectedCategory, selectedLevel, searchTerm]);

  const handleClearLogs = async () => {
    if (!window.confirm('Clear all logs? This cannot be undone.')) return;
    try {
      await api.delete('/logs');
      setLogs([]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to clear logs');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fi-FI', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('fi-FI');
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Link to="/admin" style={{ marginBottom: '1rem', display: 'inline-block', color: 'var(--accent)', textDecoration: 'none' }}>
        ← Back to Admin
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>System Logs</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              style={{ width: 'auto', margin: 0 }}
            />
            Auto-refresh (3s)
          </label>
          <button className="btn btn-secondary" onClick={fetchLogs}>
            Refresh
          </button>
          <button className="btn btn-danger" onClick={handleClearLogs}>
            Clear logs
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '0.5rem', marginBottom: '1rem' }}>
          <div>
            <label>Category</label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ marginBottom: 0 }}
            >
              <option value="">All categories</option>
              {Object.entries(categories).map(([key, value]) => (
                <option key={key} value={value}>{key.charAt(0).toUpperCase() + key.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Level</label>
            <select
              value={selectedLevel}
              onChange={e => setSelectedLevel(e.target.value)}
              style={{ marginBottom: 0 }}
            >
              <option value="">All levels</option>
              {Object.entries(levels).map(([key, value]) => (
                <option key={key} value={value}>{key.charAt(0).toUpperCase() + key.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Search</label>
            <input
              placeholder="Search in message and details..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ marginBottom: 0 }}
            />
          </div>
        </div>
        {(selectedCategory || selectedLevel || searchTerm) && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              setSelectedCategory('');
              setSelectedLevel('');
              setSearchTerm('');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading logs...
        </div>
      ) : logs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          No logs found
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '1rem',
                  borderBottom: '1px solid var(--border)',
                  backgroundColor: selectedLevel === log.level ? 'var(--surface-2)' : 'transparent',
                  transition: 'background-color 0.2s'
                }}
              >
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{
                    fontSize: '1.2rem',
                    minWidth: '1.5rem',
                    color: LEVEL_COLORS[log.level]
                  }}>
                    {LEVEL_ICONS[log.level]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <strong style={{ color: LEVEL_COLORS[log.level] }}>
                          {log.level.toUpperCase()}
                        </strong>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '0.75rem', fontSize: '0.9rem' }}>
                          {log.category.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'right' }}>
                        <div>{formatDate(log.timestamp)}</div>
                        <div>{formatTime(log.timestamp)}</div>
                      </div>
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                      {log.message}
                    </div>
                    {Object.keys(log.details).length > 0 && (
                      <details style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                          Details
                        </summary>
                        <pre style={{
                          background: 'var(--surface-2)',
                          padding: '0.75rem',
                          borderRadius: '4px',
                          overflow: 'auto',
                          fontSize: '0.8rem',
                          maxHeight: '200px'
                        }}>
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Showing {logs.length} logs {autoRefresh && '(auto-refreshing every 3 seconds)'}
      </div>
    </div>
  );
}
