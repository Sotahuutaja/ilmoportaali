import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

const currentYear = new Date().getFullYear();

export default function Register() {
  const [form, setForm] = useState({
	first_name: '', last_name: '', email: '', password: '',
	year_of_birth: '', gender: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/register', {
        ...form,
        year_of_birth: parseInt(form.year_of_birth)
      });
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
          <label>First name</label>
		  <input
		    value={form.first_name}
		    onChange={e => setForm({ ...form, first_name: e.target.value })}
		    required
		  />
		  <label>Last name</label>
		  <input
		    value={form.last_name}
		    onChange={e => setForm({ ...form, last_name: e.target.value })}
		    required
		  />
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
          />
          <label>Password</label>
          <input
            type="password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            required
          />
          <label>Year of birth</label>
          <input
            type="number"
            min="1940"
            max={currentYear}
            value={form.year_of_birth}
            onChange={e => setForm({ ...form, year_of_birth: e.target.value })}
            placeholder={`1940 – ${currentYear}`}
            required
          />
          <label>Gender</label>
          <select
            value={form.gender}
            onChange={e => setForm({ ...form, gender: e.target.value })}
            required
          >
            <option value="">Select...</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Register
          </button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          Have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}