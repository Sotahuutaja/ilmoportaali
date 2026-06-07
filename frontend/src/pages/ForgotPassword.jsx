import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
      setMessage('Check your email for password reset instructions.');
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reset email');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '3rem auto' }}>
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>Forgot password?</h2>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        {!submitted ? (
          <>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit}>
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your-email@example.com"
                required
              />
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Send reset link
              </button>
            </form>
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>
            If an account exists with that email, you will receive reset instructions shortly.
          </p>
        )}

        <p style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
