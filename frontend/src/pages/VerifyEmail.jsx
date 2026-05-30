import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token found.');
      return;
    }

    api.get(`/auth/verify-email?token=${token}`)
      .then(res => {
        setStatus('success');
        setMessage(res.data.message);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Verification failed.');
      });
  }, []);

  return (
    <div style={{ maxWidth: 400, margin: '3rem auto' }}>
      <div className="card" style={{ textAlign: 'center' }}>
        {status === 'verifying' && (
          <>
            <h2 style={{ marginBottom: '1rem' }}>Verifying your email...</h2>
            <p style={{ color: 'var(--text-muted)' }}>Please wait.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <h2 style={{ marginBottom: '1rem' }}>✓ Email verified!</h2>
            <p style={{ color: '#27ae60', marginBottom: '1.5rem' }}>{message}</p>
            <Link to="/login">
              <button className="btn btn-primary" style={{ width: '100%' }}>Log in</button>
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <h2 style={{ marginBottom: '1rem' }}>Verification failed</h2>
            <p style={{ color: '#c0392b', marginBottom: '1.5rem' }}>{message}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              The link may have expired. Request a new one below.
            </p>
            <ResendVerification />
          </>
        )}
      </div>
    </div>
  );
}

function ResendVerification() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleResend = async (e) => {
    e.preventDefault();
    setMessage(''); setError('');
    try {
      const res = await api.post('/auth/resend-verification', { email });
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend');
    }
  };

  return (
    <form onSubmit={handleResend}>
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
      <label>Your email</label>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>
        Resend verification email
      </button>
    </form>
  );
}