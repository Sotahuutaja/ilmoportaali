const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  const { email, password, first_name, last_name, year_of_birth, gender } = req.body;

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'Email, password, first name and last name are required' });
  }
  if (!year_of_birth) {
    return res.status(400).json({ error: 'Year of birth is required' });
  }
  if (!gender) {
    return res.status(400).json({ error: 'Gender is required' });
  }

  const currentYear = new Date().getFullYear();
  if (year_of_birth < 1940 || year_of_birth > currentYear) {
    return res.status(400).json({ error: `Year of birth must be between 1940 and ${currentYear}` });
  }
  if (!['Male', 'Female', 'Other'].includes(gender)) {
    return res.status(400).json({ error: 'Gender must be Male, Female or Other' });
  }

  try {
    const hashed = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password, first_name, last_name, year_of_birth, gender) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, role',
      [email, hashed, first_name, last_name, year_of_birth, gender]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Registration failed:', err.message);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role }
    });
  } catch (err) {
    console.error('Login failed:', err.message);
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});

// Get current user
router.get('/me', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT id, email, first_name, last_name, role, year_of_birth, gender FROM users WHERE id = $1',
    [req.user.id]
  );
  res.json({ user: result.rows[0] });
});

// Update own profile
router.put('/profile', requireAuth, async (req, res) => {
  const { first_name, last_name, email, password, year_of_birth, gender } = req.body;

  try {
    if (password && password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const currentYear = new Date().getFullYear();
    if (year_of_birth && (year_of_birth < 1940 || year_of_birth > currentYear)) {
      return res.status(400).json({ error: `Year of birth must be between 1940 and ${currentYear}` });
    }
    if (gender && !['Male', 'Female', 'Other'].includes(gender)) {
      return res.status(400).json({ error: 'Gender must be Male, Female or Other' });
    }

    const updates = [];
    const values = [];
    let i = 1;

    if (first_name) { updates.push(`first_name = $${i++}`); values.push(first_name); }
    if (last_name) { updates.push(`last_name = $${i++}`); values.push(last_name); }
    if (email) { updates.push(`email = $${i++}`); values.push(email); }
    if (password) {
      const hashed = await bcrypt.hash(password, 12);
      updates.push(`password = $${i++}`);
      values.push(hashed);
    }
    if (year_of_birth) { updates.push(`year_of_birth = $${i++}`); values.push(year_of_birth); }
    if (gender) { updates.push(`gender = $${i++}`); values.push(gender); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    values.push(req.user.id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, email, first_name, last_name, role, year_of_birth, gender`,
      values
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    console.error('Failed to update profile:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});


module.exports = router;