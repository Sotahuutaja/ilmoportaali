const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password and name are required' });
  }

  try {
    const hashed = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name, role',
      [email, hashed, name]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
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
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    console.error('Login failed:', err.message);
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});

// Get current user
router.get('/me', require('../middleware/auth').requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT id, email, name, role FROM users WHERE id = $1',
    [req.user.id]
  );
  res.json({ user: result.rows[0] });
});

module.exports = router;