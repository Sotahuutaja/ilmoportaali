const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole, optionalAuth } = require('../middleware/auth');
const { canManageEvent } = require('../utils/eventAccess');
const { visibilityClause } = require('../utils/eventVisibility');
const { logHelpers } = require('../services/logService');
const router = express.Router();


// List all events (public, but a restrict_visibility event is filtered out for anyone
// who isn't its manager, an admin, an eligible team's approved member, or already
// registered for it — see utils/eventVisibility.js)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id ?? null;
    const userRole = req.user?.role ?? null;
    const result = await pool.query(`
      SELECT e.*, u.name as creator_name,
        (SELECT COUNT(DISTINCT r.id)::integer
         FROM registrations r
         JOIN registration_products rp ON rp.registration_id = r.id AND rp.deleted_at IS NULL
         JOIN event_products ep ON ep.id = rp.product_id AND ep.is_identifying = TRUE
         WHERE r.event_id = e.id) as registration_count
      FROM events e
      LEFT JOIN users u ON e.creator_id = u.id
      WHERE ${visibilityClause('$1', '$2')}
      ORDER BY e.starts_at ASC
    `, [userId, userRole]);
    res.json({ events: result.rows });
  } catch (err) {
    console.error('Failed to fetch events:', err.message);
    res.status(500).json({ error: 'Failed to fetch events', detail: err.message });
  }
});

// Get events I can manage (creator, co-manager, or admin)
router.get('/manageable', requireAuth, requireRole(pool, 'creator', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (e.id) e.*, u.first_name, u.last_name,
        (SELECT COUNT(DISTINCT r.id)::integer
         FROM registrations r
         JOIN registration_products rp ON rp.registration_id = r.id AND rp.deleted_at IS NULL
         JOIN event_products ep ON ep.id = rp.product_id AND ep.is_identifying = TRUE
         WHERE r.event_id = e.id) as registration_count,
        CASE WHEN e.creator_id = $1 THEN true ELSE false END as is_owner
      FROM events e
      LEFT JOIN users u ON e.creator_id = u.id
      LEFT JOIN event_managers em ON e.id = em.event_id
      WHERE e.creator_id = $1 OR em.user_id = $1 OR $2 = 'admin'
      ORDER BY e.id, e.starts_at ASC
    `, [req.user.id, req.user.role]);
    res.json({ events: result.rows });
  } catch (err) {
    console.error('Failed to fetch manageable events:', err.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get single event (public, subject to the same visibility rule as the listing above —
// a restricted event a requester isn't allowed to see 404s exactly like a non-existent
// one would, rather than a 403, so its existence isn't leaked to someone who shouldn't
// know about it)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id ?? null;
    const userRole = req.user?.role ?? null;
    const result = await pool.query(`
      SELECT e.*, u.name as creator_name,
        (SELECT COUNT(DISTINCT r.id)::integer
         FROM registrations r
         JOIN registration_products rp ON rp.registration_id = r.id AND rp.deleted_at IS NULL
         JOIN event_products ep ON ep.id = rp.product_id AND ep.is_identifying = TRUE
         WHERE r.event_id = e.id) as registration_count
      FROM events e
      LEFT JOIN users u ON e.creator_id = u.id
      WHERE e.id = $1 AND ${visibilityClause('$2', '$3')}
    `, [req.params.id, userId, userRole]);

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
router.post('/', requireAuth, requireRole(pool, 'creator', 'admin'), async (req, res) => {
  const { title, description, location, starts_at, ends_at, capacity, allow_individual_registration, registration_starts_at, registration_ends_at, volunteering_enabled, restrict_visibility } = req.body;

  if (!title || !starts_at || !ends_at) {
    return res.status(400).json({ error: 'Title, start time and end time are required' });
  }
  if (!registration_starts_at || !registration_ends_at) {
    return res.status(400).json({ error: 'Registration start and end times are required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO events (title, description, location, starts_at, ends_at, capacity, creator_id, allow_individual_registration, registration_starts_at, registration_ends_at, volunteering_enabled, restrict_visibility)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [title, description, location, starts_at, ends_at, capacity, req.user.id, allow_individual_registration ?? true, registration_starts_at, registration_ends_at, !!volunteering_enabled, !!restrict_visibility]);

    logHelpers.eventCreated(result.rows[0].id, result.rows[0].title, req.user.id);

    res.status(201).json({ event: result.rows[0] });
  } catch (err) {
    console.error('Failed to create event:', err.message);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update event (creator, co-manager, or admin)
router.put('/:id', requireAuth, requireRole(pool, 'creator', 'admin'), async (req, res) => {
  const { title, description, location, starts_at, ends_at, capacity, allow_individual_registration, registration_starts_at, registration_ends_at, stripe_mode, volunteering_enabled, restrict_visibility } = req.body;

  if (!registration_starts_at || !registration_ends_at) {
    return res.status(400).json({ error: 'Registration start and end times are required' });
  }

  // Validate stripe_mode if provided
  if (stripe_mode && !['test', 'live'].includes(stripe_mode)) {
    return res.status(400).json({ error: 'stripe_mode must be either "test" or "live"' });
  }

  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.id, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised to edit this event' });

    const existing = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Event not found' });

    const result = await pool.query(`
      UPDATE events
      SET title=$1, description=$2, location=$3, starts_at=$4, ends_at=$5, capacity=$6, allow_individual_registration=$7, registration_starts_at=$8, registration_ends_at=$9, stripe_mode=$10, volunteering_enabled=$11, restrict_visibility=$12
      WHERE id=$13
      RETURNING *
    `, [title, description, location, starts_at, ends_at, capacity, allow_individual_registration ?? true, registration_starts_at, registration_ends_at, stripe_mode || 'test', !!volunteering_enabled, !!restrict_visibility, req.params.id]);

    logHelpers.eventUpdated(result.rows[0].id, result.rows[0].title, req.user.id);

    if (!!volunteering_enabled !== existing.rows[0].volunteering_enabled) {
      logHelpers.volunteeringToggled(result.rows[0].id, result.rows[0].title, !!volunteering_enabled, req.user.id);
    }

    res.json({ event: result.rows[0] });
  } catch (err) {
    console.error('Failed to update event:', err.message);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event (creator, co-manager, or admin)
// Note: All registrations must be cancelled first to ensure refunds are properly issued
router.delete('/:id', requireAuth, requireRole(pool, 'creator', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.id, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised to delete this event' });

    const existing = await client.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Event not found' });

    // Check if there are any registrations for this event
    const registrations = await client.query(
      'SELECT COUNT(*) as count FROM registrations WHERE event_id = $1',
      [req.params.id]
    );

    if (registrations.rows[0].count > 0) {
      return res.status(409).json({
        error: 'Cannot delete event with active registrations',
        message: 'All registrations must be cancelled individually before the event can be deleted. This ensures refunds are properly issued to attendees.',
        registrationCount: parseInt(registrations.rows[0].count)
      });
    }

    await client.query('BEGIN');

    // Delete the event (registrations are already deleted)
    await client.query('DELETE FROM events WHERE id = $1', [req.params.id]);

    await client.query('COMMIT');

    logHelpers.eventDeleted(req.params.id, existing.rows[0].title, req.user.id);

    res.json({ message: 'Event deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to delete event:', err.message);
    res.status(500).json({ error: 'Failed to delete event' });
  } finally {
    client.release();
  }
});

// Get event managers
router.get('/:id/managers', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT em.*, u.first_name, u.last_name, u.email
      FROM event_managers em
      JOIN users u ON em.user_id = u.id
      WHERE em.event_id = $1
    `, [req.params.id]);
    res.json({ managers: result.rows });
  } catch (err) {
    console.error('Failed to fetch managers:', err.message);
    res.status(500).json({ error: 'Failed to fetch managers' });
  }
});

// Add event manager (creator or admin)
router.post('/:id/managers', requireAuth, async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.id, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised' });

    // Verify target user is creator or admin
    const target = await pool.query('SELECT role FROM users WHERE id = $1', [user_id]);
    if (!target.rows[0]) return res.status(404).json({ error: 'User not found' });
    if (!['creator', 'admin'].includes(target.rows[0].role)) {
      return res.status(400).json({ error: 'Only users with creator role or above can be managers' });
    }

    const result = await pool.query(
      'INSERT INTO event_managers (event_id, user_id) VALUES ($1, $2) RETURNING *',
      [req.params.id, user_id]
    );

    const eventForLog = await pool.query('SELECT title FROM events WHERE id = $1', [req.params.id]);
    logHelpers.eventManagerAdded(req.params.id, eventForLog.rows[0]?.title, user_id, req.user.id);

    res.status(201).json({ manager: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'User is already a manager' });
    console.error('Failed to add manager:', err.message);
    res.status(500).json({ error: 'Failed to add manager' });
  }
});

// Remove event manager (creator or admin)
router.delete('/:id/managers/:userId', requireAuth, async (req, res) => {
  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.id, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised' });

    await pool.query(
      'DELETE FROM event_managers WHERE event_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    );

    const eventForLog = await pool.query('SELECT title FROM events WHERE id = $1', [req.params.id]);
    logHelpers.eventManagerRemoved(req.params.id, eventForLog.rows[0]?.title, req.params.userId, req.user.id);

    res.json({ message: 'Manager removed' });
  } catch (err) {
    console.error('Failed to remove manager:', err.message);
    res.status(500).json({ error: 'Failed to remove manager' });
  }
});

// Get allowed teams for an event (public)
router.get('/:id/teams', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT et.*, t.name, t.description,
        COUNT(tm.id) FILTER (WHERE tm.status = 'approved')::integer as member_count
      FROM event_teams et
      JOIN teams t ON et.team_id = t.id
      LEFT JOIN team_members tm ON t.id = tm.team_id
      WHERE et.event_id = $1
      GROUP BY et.id, t.name, t.description
      ORDER BY t.name ASC
    `, [req.params.id]);
    res.json({ teams: result.rows });
  } catch (err) {
    console.error('Failed to fetch event teams:', err.message);
    res.status(500).json({ error: 'Failed to fetch event teams' });
  }
});

// Add allowed team to event (creator, co-manager or admin)
router.post('/:id/teams', requireAuth, async (req, res) => {
  const { team_id } = req.body;
  if (!team_id) return res.status(400).json({ error: 'team_id is required' });

  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.id, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised' });

    const result = await pool.query(
      'INSERT INTO event_teams (event_id, team_id) VALUES ($1, $2) RETURNING *',
      [req.params.id, team_id]
    );
    res.status(201).json({ eventTeam: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Team already allowed for this event' });
    console.error('Failed to add event team:', err.message);
    res.status(500).json({ error: 'Failed to add team' });
  }
});

// Remove allowed team from event (creator, co-manager or admin)
router.delete('/:id/teams/:teamId', requireAuth, async (req, res) => {
  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.id, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised' });

    await pool.query(
      'DELETE FROM event_teams WHERE event_id = $1 AND team_id = $2',
      [req.params.id, req.params.teamId]
    );
    res.json({ message: 'Team removed from event' });
  } catch (err) {
    console.error('Failed to remove event team:', err.message);
    res.status(500).json({ error: 'Failed to remove team' });
  }
});

module.exports = { router, canManageEvent };