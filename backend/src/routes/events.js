const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// List all events (public)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, u.name as creator_name,
        COUNT(r.id)::integer as registration_count
      FROM events e
      LEFT JOIN users u ON e.creator_id = u.id
      LEFT JOIN registrations r ON e.id = r.event_id
      GROUP BY e.id, u.name
      ORDER BY e.starts_at ASC
    `);
    res.json({ events: result.rows });
  } catch (err) {
    console.error('Failed to fetch events:', err.message);
    res.status(500).json({ error: 'Failed to fetch events', detail: err.message });
  }
});

// Get single event (public)
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, u.name as creator_name,
        COUNT(r.id)::integer as registration_count
      FROM events e
      LEFT JOIN users u ON e.creator_id = u.id
      LEFT JOIN registrations r ON e.id = r.event_id
      WHERE e.id = $1
      GROUP BY e.id, u.name
    `, [req.params.id]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ event: result.rows[0] });
  } catch (err) {
    console.error('Failed to fetch events:', err.message);
    res.status(500).json({ error: 'Failed to fetch events', detail: err.message });
  }
});

// Create event (creator or admin only)
router.post('/', requireAuth, requireRole('creator', 'admin'), async (req, res) => {
  const { title, description, location, starts_at, ends_at, capacity } = req.body;

  if (!title || !starts_at || !ends_at) {
    return res.status(400).json({ error: 'Title, start time and end time are required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO events (title, description, location, starts_at, ends_at, capacity, creator_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [title, description, location, starts_at, ends_at, capacity, req.user.id]);

    res.status(201).json({ event: result.rows[0] });
  } catch (err) {
    console.error('Failed to fetch events:', err.message);
    res.status(500).json({ error: 'Failed to fetch events', detail: err.message });
  }
});

// Update event (creator who owns it, or admin)
router.put('/:id', requireAuth, requireRole('creator', 'admin'), async (req, res) => {
  const { title, description, location, starts_at, ends_at, capacity } = req.body;

  try {
    const existing = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (req.user.role !== 'admin' && existing.rows[0].creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorised to edit this event' });
    }

    const result = await pool.query(`
      UPDATE events
      SET title=$1, description=$2, location=$3, starts_at=$4, ends_at=$5, capacity=$6
      WHERE id=$7
      RETURNING *
    `, [title, description, location, starts_at, ends_at, capacity, req.params.id]);

    res.json({ event: result.rows[0] });
  } catch (err) {
    console.error('Failed to fetch events:', err.message);
    res.status(500).json({ error: 'Failed to fetch events', detail: err.message });
  }
});

// Delete event (creator who owns it, or admin)
router.delete('/:id', requireAuth, requireRole('creator', 'admin'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (req.user.role !== 'admin' && existing.rows[0].creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorised to delete this event' });
    }

    await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error('Failed to fetch events:', err.message);
    res.status(500).json({ error: 'Failed to fetch events', detail: err.message });
  }
});

module.exports = router;