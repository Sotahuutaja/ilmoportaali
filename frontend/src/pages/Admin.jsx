import { useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div style={{ maxWidth: 800, margin: '3rem auto' }}>
      <h1>Admin Panel</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Manage users and teams from the following sections:
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
        <Link to="/admin/users" style={{ textDecoration: 'none' }}>
          <div className="card" style={{
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            border: '2px solid transparent',
            height: '100%'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.background = 'var(--surface-2)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.background = 'transparent';
          }}
          >
            <h2 style={{ color: 'var(--accent)', marginTop: 0 }}>👥 User Management</h2>
            <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>
              Manage user accounts, roles, and permissions
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }}>
              Manage Users
            </button>
          </div>
        </Link>

        <Link to="/admin/teams" style={{ textDecoration: 'none' }}>
          <div className="card" style={{
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            border: '2px solid transparent',
            height: '100%'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.background = 'var(--surface-2)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.background = 'transparent';
          }}
          >
            <h2 style={{ color: 'var(--accent)', marginTop: 0 }}>🏆 Team Management</h2>
            <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>
              Create and manage teams, assign captains, and configure settings
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }}>
              Manage Teams
            </button>
          </div>
        </Link>

        <Link to="/admin/logs" style={{ textDecoration: 'none' }}>
          <div className="card" style={{
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            border: '2px solid transparent',
            height: '100%'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.background = 'var(--surface-2)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.background = 'transparent';
          }}
          >
            <h2 style={{ color: 'var(--accent)', marginTop: 0 }}>📋 System Logs</h2>
            <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 1.5rem' }}>
              View and troubleshoot registration, payment, and system errors
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }}>
              View Logs
            </button>
          </div>
        </Link>
      </div>
    </div>
  );
}
