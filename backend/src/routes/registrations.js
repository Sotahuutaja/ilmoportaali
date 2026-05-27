const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Helper: validate and reserve products
async function insertProducts(client, registrationId, products, eventId) {
  for (const { product_id, quantity = 1 } of products) {
    const product = await client.query(
      'SELECT * FROM event_products WHERE id = $1 AND event_id = $2',
      [product_id, eventId]
    );
    if (!product.rows[0]) throw new Error(`Product ${product_id} not found`);

    if (product.rows[0].quantity !== null) {
      const used = await client.query(
        'SELECT COALESCE(SUM(quantity), 0) as used FROM registration_products WHERE product_id = $1',
        [product_id]
      );
      const remaining = product.rows[0].quantity - parseInt(used.rows[0].used);
      if (remaining < quantity) throw new Error(`Product "${product.rows[0].name}" has insufficient stock`);
    }

    await client.query(
      'INSERT INTO registration_products (registration_id, product_id, quantity) VALUES ($1, $2, $3)',
      [registrationId, product_id, quantity]
    );
  }
}

// Register self for an event
router.post('/:eventId', requireAuth, async (req, res) => {
  const { team_id, products = [] } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const event = await client.query('SELECT * FROM events WHERE id = $1', [req.params.eventId]);
    if (!event.rows[0]) return res.status(404).json({ error: 'Event not found' });

    if (event.rows[0].capacity) {
      const count = await client.query(
        'SELECT COUNT(*) FROM registrations WHERE event_id = $1',
        [req.params.eventId]
      );
      if (parseInt(count.rows[0].count) >= event.rows[0].capacity) {
        return res.status(409).json({ error: 'Event is full' });
      }
    }

    if (team_id) {
      const membership = await client.query(
        'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = $3',
        [team_id, req.user.id, 'approved']
      );
      if (!membership.rows[0]) return res.status(403).json({ error: 'Not an approved team member' });
    }

    const reg = await client.query(
      'INSERT INTO registrations (user_id, event_id, team_id) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, req.params.eventId, team_id || null]
    );

    if (products.length > 0) {
      await insertProducts(client, reg.rows[0].id, products, req.params.eventId);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Registered successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Already registered for this event' });
    res.status(500).json({ error: err.message || 'Registration failed' });
  } finally {
    client.release();
  }
});

// Captain registers a guest
router.post('/:eventId/guest', requireAuth, async (req, res) => {
  const { guest_name, guest_email, team_id, products = [] } = req.body;

  if (!guest_name || !guest_email) {
    return res.status(400).json({ error: 'Guest name and email are required' });
  }
  if (!team_id) {
    return res.status(400).json({ error: 'Team is required for guest registration' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify caller is captain of the team
    const membership = await client.query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND role = $3 AND status = $4',
      [team_id, req.user.id, 'captain', 'approved']
    );
    if (!membership.rows[0] && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only team captains can register guests' });
    }

    const event = await client.query('SELECT * FROM events WHERE id = $1', [req.params.eventId]);
    if (!event.rows[0]) return res.status(404).json({ error: 'Event not found' });

    if (event.rows[0].capacity) {
      const count = await client.query(
        'SELECT COUNT(*) FROM registrations WHERE event_id = $1',
        [req.params.eventId]
      );
      if (parseInt(count.rows[0].count) >= event.rows[0].capacity) {
        return res.status(409).json({ error: 'Event is full' });
      }
    }

    const reg = await client.query(`
      INSERT INTO registrations (event_id, team_id, is_guest, guest_name, guest_email)
      VALUES ($1, $2, TRUE, $3, $4) RETURNING *
    `, [req.params.eventId, team_id, guest_name, guest_email]);

    if (products.length > 0) {
      await insertProducts(client, reg.rows[0].id, products, req.params.eventId);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Guest registered successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message || 'Guest registration failed' });
  } finally {
    client.release();
  }
});

// Cancel own registration
router.delete('/:eventId', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM registrations WHERE user_id = $1 AND event_id = $2',
      [req.user.id, req.params.eventId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Registration not found' });
    res.json({ message: 'Registration cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel registration' });
  }
});

// Get registrations for an event (creator or admin)
router.get('/:eventId', requireAuth, async (req, res) => {
  try {
    const event = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.eventId]);
    if (!event.rows[0]) return res.status(404).json({ error: 'Event not found' });

    if (req.user.role !== 'admin' && event.rows[0].creator_id !== req.user.id) {
      // Captains can see their team's registrations
      const captainOf = await pool.query(
        'SELECT team_id FROM team_members WHERE user_id = $1 AND role = $2 AND status = $3',
        [req.user.id, 'captain', 'approved']
      );
      if (captainOf.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorised' });
      }
    }

    const result = await pool.query(`
      SELECT
        r.*,
        u.first_name, u.last_name, u.email as user_email,
        t.name as team_name,
        json_agg(json_build_object(
          'product_id', rp.product_id,
          'name', ep.name,
          'quantity', rp.quantity,
          'price', ep.price
        )) FILTER (WHERE rp.id IS NOT NULL) as products
      FROM registrations r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN teams t ON r.team_id = t.id
      LEFT JOIN registration_products rp ON r.id = rp.registration_id
      LEFT JOIN event_products ep ON rp.product_id = ep.id
      WHERE r.event_id = $1
      GROUP BY r.id, u.first_name, u.last_name, u.email, t.name
      ORDER BY r.created_at ASC
    `, [req.params.eventId]);

    res.json({ registrations: result.rows });
  } catch (err) {
    console.error('Failed to fetch registrations:', err.message);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Cancel any registration (admin or event creator)
router.delete('/:eventId/registrations/:registrationId', requireAuth, async (req, res) => {
  try {
    const event = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.eventId]);
    if (!event.rows[0]) return res.status(404).json({ error: 'Event not found' });

    if (req.user.role !== 'admin' && event.rows[0].creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorised' });
    }

    const result = await pool.query(
      'DELETE FROM registrations WHERE id = $1 AND event_id = $2 RETURNING id',
      [req.params.registrationId, req.params.eventId]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Registration not found' });
    res.json({ message: 'Registration cancelled' });
  } catch (err) {
    console.error('Failed to cancel registration:', err.message);
    res.status(500).json({ error: 'Failed to cancel registration' });
  }
});

// Get my registrations
router.get('/my/list', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, r.created_at as registered_at, r.team_id, t.name as team_name,
        json_agg(json_build_object(
          'name', ep.name,
          'quantity', rp.quantity,
          'price', ep.price
        )) FILTER (WHERE rp.id IS NOT NULL) as products
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      LEFT JOIN teams t ON r.team_id = t.id
      LEFT JOIN registration_products rp ON r.id = rp.registration_id
      LEFT JOIN event_products ep ON rp.product_id = ep.id
      WHERE r.user_id = $1
      GROUP BY e.id, r.id, t.name
      ORDER BY e.starts_at ASC
    `, [req.user.id]);
    res.json({ registrations: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Update a registration (admin or event creator)
router.put('/:eventId/registrations/:registrationId', requireAuth, async (req, res) => {
  const { guest_name, guest_email, first_name, last_name, email, team_id, products } = req.body;

  const client = await pool.connect();
  try {
    const event = await client.query('SELECT * FROM events WHERE id = $1', [req.params.eventId]);
    if (!event.rows[0]) return res.status(404).json({ error: 'Event not found' });

    if (req.user.role !== 'admin' && event.rows[0].creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorised' });
    }

    const reg = await client.query('SELECT * FROM registrations WHERE id = $1', [req.params.registrationId]);
    if (!reg.rows[0]) return res.status(404).json({ error: 'Registration not found' });

    await client.query('BEGIN');

    if (reg.rows[0].is_guest) {
      // Update guest details
      await client.query(
        'UPDATE registrations SET guest_name = COALESCE($1, guest_name), guest_email = COALESCE($2, guest_email), team_id = $3 WHERE id = $4',
        [guest_name, guest_email, team_id || null, req.params.registrationId]
      );
    } else {
      // Update registered user details and team
      await client.query(
        'UPDATE registrations SET team_id = $1 WHERE id = $2',
        [team_id || null, req.params.registrationId]
      );
      // Update user's name and email if provided
      if (first_name || last_name || email) {
        await client.query(
          `UPDATE users SET
            first_name = COALESCE($1, first_name),
            last_name = COALESCE($2, last_name),
            email = COALESCE($3, email)
          WHERE id = $4`,
          [first_name, last_name, email, reg.rows[0].user_id]
        );
      }
    }

    // Update products
    if (products !== undefined) {
      await client.query('DELETE FROM registration_products WHERE registration_id = $1', [req.params.registrationId]);
      if (products.length > 0) {
        await insertProducts(client, req.params.registrationId, products, req.params.eventId);
      }
    }

    await client.query('COMMIT');

    // Return updated registration
    const updated = await pool.query(`
      SELECT
        r.*,
        u.first_name, u.last_name, u.email as user_email,
        t.name as team_name,
        json_agg(json_build_object(
          'product_id', rp.product_id,
          'name', ep.name,
          'quantity', rp.quantity,
          'price', ep.price
        )) FILTER (WHERE rp.id IS NOT NULL) as products
      FROM registrations r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN teams t ON r.team_id = t.id
      LEFT JOIN registration_products rp ON r.id = rp.registration_id
      LEFT JOIN event_products ep ON rp.product_id = ep.id
      WHERE r.id = $1
      GROUP BY r.id, u.first_name, u.last_name, u.email, t.name
    `, [req.params.registrationId]);

    res.json({ registration: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to update registration:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update registration' });
  } finally {
    client.release();
  }
});

module.exports = router;