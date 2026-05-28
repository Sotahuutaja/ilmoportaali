import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const token = searchParams.get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (password !== confirm) return setError('Passwords do not match');
    try {
      const res = await api.post('/auth/reset-password', { token, password });
      setMessage(res.data.message);
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    }
  };

  if (!token) return (
    <div style={{ maxWidth: 400, margin: '3rem auto' }}>
      <div className="card" style={{ textAlign: 'center' }}>
        <h2 style={{ marginBottom: '1rem' }}>Invalid link</h2>
        <p style={{ color: '#888' }}>This password reset link is invalid.</p>
        <Link to="/login"><button className="btn btn-secondary" style={{ marginTop: '1rem' }}>Back to login</button></Link>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 400, margin: '3rem auto' }}>
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>Reset password</h2>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
        {done ? (
          <p style={{ color: '#888' }}>Redirecting to login...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>New password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
            />
            <label>Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Reset password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}