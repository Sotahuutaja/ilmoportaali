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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '3rem auto' }}>
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>Log in</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Log in</button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}