const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/security');
const crypto = require('crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');

// Rate limit presets for auth endpoints
const loginLimit = rateLimit({ max: 10, windowMs: 15 * 60 * 1000 });
const registerLimit = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });
const emailLimit = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });

// Register
router.post('/register', registerLimit, async (req, res) => {
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
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const result = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, year_of_birth, gender, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, first_name, last_name, role`,
      [email, hashed, first_name, last_name, year_of_birth, gender, token, expires]
    );

    await sendVerificationEmail(email, token);

    res.status(201).json({
      user: result.rows[0],
      message: 'Registration successful. Please check your email to verify your account.'
    });
  } catch (err) {
    console.error('Registration failed:', err.message);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
});

// Login
router.post('/login', loginLimit, async (req, res) => {
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

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email before logging in', unverified: true });
    }

    // Create access token (short-lived)
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Create refresh token (longer-lived)
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set httpOnly cookies (inaccessible to JavaScript)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 2 * 60 * 60 * 1000 // 2 hours
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Return only user data, not tokens
    res.json({
      user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role }
    });
  } catch (err) {
    console.error('Login failed:', err.message);
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});

// Verify email
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;

  if (!token) return res.status(400).json({ error: 'Token is required' });

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE verification_token = $1 AND verification_token_expires > NOW()',
      [token]
    );

    if (!result.rows[0]) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    await pool.query(
      'UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_token_expires = NULL WHERE id = $1',
      [result.rows[0].id]
    );

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    console.error('Verification failed:', err.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Resend verification email
router.post('/resend-verification', emailLimit, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified) return res.status(400).json({ error: 'Email already verified' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3',
      [token, expires, user.id]
    );

    await sendVerificationEmail(email, token);
    res.json({ message: 'Verification email resent.' });
  } catch (err) {
    console.error('Resend failed:', err.message);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});


// Get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role, year_of_birth, gender FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Failed to fetch current user:', err.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
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


// Request password reset
router.post('/forgot-password', emailLimit, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    // Always return success to prevent email enumeration
    if (!user) return res.json({ message: 'If that email exists you will receive a reset link.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      'UPDATE users SET password_reset_token = $1, password_reset_token_expires = $2 WHERE id = $3',
      [token, expires, user.id]
    );

    await sendPasswordResetEmail(email, token);
    res.json({ message: 'If that email exists you will receive a reset link.' });
  } catch (err) {
    console.error('Forgot password failed:', err.message);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_token_expires > NOW()',
      [token]
    );

    if (!result.rows[0]) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashed = await bcrypt.hash(password, 12);
    await pool.query(
      'UPDATE users SET password = $1, password_reset_token = NULL, password_reset_token_expires = NULL WHERE id = $2',
      [hashed, result.rows[0].id]
    );

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password failed:', err.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Logout
router.post('/logout', requireAuth, (req, res) => {
  // Clear both cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;