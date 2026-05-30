import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [unverified, setUnverified] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendMessage, setResendMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setUnverified(false);
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      if (err.response?.data?.unverified) {
        setUnverified(true);
        setResendEmail(email);
      } else {
        setError(err.response?.data?.error || 'Login failed');
      }
    }
  };
  
  const handleResend = async () => {
    try {
      await api.post('/auth/resend-verification', { email: resendEmail });
      setResendMessage('Verification email sent! Check your inbox.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '3rem auto' }}>
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>Log in</h2>
        {error && <p className="error">{error}</p>}
    {unverified && (
      <div style={{ background: '#fff3cd', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
      <p style={{ marginBottom: '0.5rem' }}>Your email is not verified yet.</p>
      {resendMessage
        ? <p className="success">{resendMessage}</p>
        : <button className="btn btn-secondary" onClick={handleResend}>Resend verification email</button>
      }
      </div>
    )}
        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Log in</button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Link to="/reset-password">Forgot password?</Link>
        </p>
        <p style={{ marginTop: '0.5rem', textAlign: 'center' }}>
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}