import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/register', form);
      setSuccess('Account created! You can now log in.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '3rem auto' }}>
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>Create account</h2>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
        <form onSubmit={handleSubmit}>
          <label>Name</label>
          <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          <label>Password</label>
          <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Register</button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          Have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}