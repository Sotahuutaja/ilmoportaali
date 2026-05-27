const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require admin
router.use(requireAuth, requireRole('admin'));

// List all users
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, year_of_birth, gender, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Failed to fetch users:', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user (name, email, role)
router.put('/:id', async (req, res) => {
  const { name, email, role } = req.body;
  const validRoles = ['attendee', 'creator', 'admin'];

  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        role = COALESCE($3, role)
       WHERE id = $4
       RETURNING id, email, name, role`,
      [name, email, role, req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Failed to update user:', err.message);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Reset user password
router.put('/:id/password', async (req, res) => {
  const { password } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const hashed = await bcrypt.hash(password, 12);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.params.id]);
    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('Failed to reset password:', err.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Failed to delete user:', err.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;