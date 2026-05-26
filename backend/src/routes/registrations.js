const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Register for an event
router.post('/:eventId', requireAuth, async (req, res) => {
  try {
    const event = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.eventId]);
    if (!event.rows[0]) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check capacity
    if (event.rows[0].capacity) {
      const count = await pool.query(
        'SELECT COUNT(*) FROM registrations WHERE event_id = $1',
        [req.params.eventId]
      );
      if (parseInt(count.rows[0].count) >= event.rows[0].capacity) {
        return res.status(409).json({ error: 'Event is full' });
      }
    }

    await pool.query(
      'INSERT INTO registrations (user_id, event_id) VALUES ($1, $2)',
      [req.user.id, req.params.eventId]
    );

    res.status(201).json({ message: 'Registered successfully' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Already registered for this event' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Cancel registration
router.delete('/:eventId', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM registrations WHERE user_id = $1 AND event_id = $2',
      [req.user.id, req.params.eventId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json({ message: 'Registration cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel registration' });
  }
});

// Get my registrations
router.get('/my', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, r.created_at as registered_at
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.user_id = $1
      ORDER BY e.starts_at ASC
    `, [req.user.id]);

    res.json({ registrations: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

module.exports = router;