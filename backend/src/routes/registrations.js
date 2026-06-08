const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();
const { canManageEvent } = require('../utils/eventAccess');
const stripe = require('../services/stripeService');
const { sendAdditionalPaymentEmail, sendRefundEmail } = require('../services/email');

// Helper: calculate total price for a set of products
async function calculateProductPrice(client, products, eventId) {
  let totalCents = 0;
  for (const { product_id, quantity = 1, field_values = {} } of products) {
    const product = await client.query(
      'SELECT price, fields FROM event_products WHERE id = $1 AND event_id = $2',
      [product_id, eventId]
    );
    if (!product.rows[0]) throw new Error(`Product ${product_id} not found`);

    let price = parseFloat(product.rows[0].price);
    const fields = product.rows[0].fields || [];

    // Check if any dropdown field has a custom price override
    for (const field of fields) {
      if (field.type === 'select') {
        const selectedValue = field_values[field.id];
        if (selectedValue) {
          const option = field.options.find(opt =>
            (typeof opt === 'string' ? opt : opt.value) === selectedValue
          );
          if (option && typeof option === 'object' && option.price !== null && option.price !== undefined) {
            price = parseFloat(option.price);
            break;
          }
        }
      }
    }

    totalCents += Math.round(price * 100) * quantity;
  }
  return totalCents;
}

// Helper: get current total price of a registration
async function getRegistrationPrice(client, registrationId) {
  const result = await client.query(`
    SELECT rp.product_id, rp.quantity, rp.field_values, ep.price, ep.fields, ep.event_id
    FROM registration_products rp
    JOIN event_products ep ON rp.product_id = ep.id
    WHERE rp.registration_id = $1
  `, [registrationId]);

  let totalCents = 0;
  for (const row of result.rows) {
    let price = parseFloat(row.price);
    const fields = row.fields || [];
    const fieldValues = row.field_values || {};

    // Check if any dropdown field has a custom price override
    for (const field of fields) {
      if (field.type === 'select') {
        const selectedValue = fieldValues[field.id];
        if (selectedValue) {
          const option = field.options.find(opt =>
            (typeof opt === 'string' ? opt : opt.value) === selectedValue
          );
          if (option && typeof option === 'object' && option.price !== null && option.price !== undefined) {
            price = parseFloat(option.price);
            break;
          }
        }
      }
    }

    totalCents += Math.round(price * 100) * row.quantity;
  }
  return totalCents;
}

// Helper: validate and reserve products
async function insertProducts(client, registrationId, products, eventId) {
  for (const { product_id, quantity = 1, field_values = {} } of products) {
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

    // Validate required custom fields
    const fields = product.rows[0].fields || [];
    for (const field of fields) {
      if (field.required && !field_values[field.id]) {
        throw new Error(`"${field.label}" is required for product "${product.rows[0].name}"`);
      }
    }

    await client.query(
      'INSERT INTO registration_products (registration_id, product_id, quantity, field_values) VALUES ($1, $2, $3, $4)',
      [registrationId, product_id, quantity, JSON.stringify(field_values)]
    );
  }
}

// Register self for an event
router.post('/:eventId', requireAuth, async (req, res) => {
  const { team_id, products = [], comments = '' } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const event = await client.query('SELECT * FROM events WHERE id = $1', [req.params.eventId]);
    if (!event.rows[0]) return res.status(404).json({ error: 'Event not found' });

    const now = new Date();
    if (event.rows[0].registration_starts_at && now < new Date(event.rows[0].registration_starts_at)) {
      return res.status(403).json({ error: 'Registration has not opened yet' });
    }
    if (event.rows[0].registration_ends_at && now > new Date(event.rows[0].registration_ends_at)) {
      return res.status(403).json({ error: 'Registration is closed' });
    }

    if (event.rows[0].capacity) {
      const count = await client.query(
        'SELECT COUNT(*) FROM registrations WHERE event_id = $1',
        [req.params.eventId]
      );
      if (parseInt(count.rows[0].count) >= event.rows[0].capacity) {
        return res.status(409).json({ error: 'Event is full' });
      }
    }

    if (!team_id && !event.rows[0].allow_individual_registration) {
      return res.status(403).json({ error: 'Individual registration is not allowed for this event — you must register as part of a team' });
    }

    if (team_id) {
      const membership = await client.query(
        'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = $3',
        [team_id, req.user.id, 'approved']
      );
      if (!membership.rows[0]) return res.status(403).json({ error: 'Not an approved team member' });

      // Check if team is allowed for this event
      const eventTeam = await client.query(
        'SELECT * FROM event_teams WHERE event_id = $1 AND team_id = $2',
        [req.params.eventId, team_id]
      );
      if (!eventTeam.rows[0]) return res.status(403).json({ error: 'This team is not allowed for this event' });
    }

    if (products.length === 0) {
      return res.status(400).json({ error: 'You must select at least one product to register' });
    }

    const reg = await client.query(
      'INSERT INTO registrations (user_id, event_id, team_id, comments) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, req.params.eventId, team_id || null, comments || null]
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
  const { guest_first_name, guest_last_name, team_id, products = [], comments = '' } = req.body;
  // Guest uses captain's email
  const guest_email = req.user.email;

  if (!guest_first_name || !guest_last_name) {
    return res.status(400).json({ error: 'Guest first name and last name are required' });
  }
  if (!team_id) {
    return res.status(400).json({ error: 'Team is required for guest registration' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const membership = await client.query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND role = $3 AND status = $4',
      [team_id, req.user.id, 'captain', 'approved']
    );
    if (!membership.rows[0] && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only team captains can register guests' });
    }

    // Check if team is allowed for this event
    const eventTeam = await client.query(
      'SELECT * FROM event_teams WHERE event_id = $1 AND team_id = $2',
      [req.params.eventId, team_id]
    );
    if (!eventTeam.rows[0]) return res.status(403).json({ error: 'This team is not allowed for this event' });

    const event = await client.query('SELECT * FROM events WHERE id = $1', [req.params.eventId]);
    if (!event.rows[0]) return res.status(404).json({ error: 'Event not found' });

    const now = new Date();
    if (event.rows[0].registration_starts_at && now < new Date(event.rows[0].registration_starts_at)) {
      return res.status(403).json({ error: 'Registration has not opened yet' });
    }
    if (event.rows[0].registration_ends_at && now > new Date(event.rows[0].registration_ends_at)) {
      return res.status(403).json({ error: 'Registration is closed' });
    }

    if (event.rows[0].capacity) {
      const count = await client.query(
        'SELECT COUNT(*) FROM registrations WHERE event_id = $1',
        [req.params.eventId]
      );
      if (parseInt(count.rows[0].count) >= event.rows[0].capacity) {
        return res.status(409).json({ error: 'Event is full' });
      }
    }

    if (products.length === 0) {
      return res.status(400).json({ error: 'You must select at least one product for the guest' });
    }

    const reg = await client.query(`
      INSERT INTO registrations (event_id, team_id, is_guest, guest_first_name, guest_last_name, guest_email, comments, registered_by)
      VALUES ($1, $2, TRUE, $3, $4, $5, $6, $7) RETURNING *
    `, [req.params.eventId, team_id, guest_first_name, guest_last_name, guest_email, comments || null, req.user.id]);

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
    // First, fetch registration details and products before deleting
    const regResult = await pool.query(
      `SELECT r.id, r.event_id, e.title, e.starts_at,
              rp.product_id, ep.name, ep.price, rp.quantity
       FROM registrations r
       JOIN events e ON r.event_id = e.id
       LEFT JOIN registration_products rp ON r.id = rp.registration_id
       LEFT JOIN event_products ep ON rp.product_id = ep.id
       WHERE r.user_id = $1 AND r.event_id = $2`,
      [req.user.id, req.params.eventId]
    );

    if (regResult.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const registrationId = regResult.rows[0].id;
    const eventTitle = regResult.rows[0].title;
    const eventDate = new Date(regResult.rows[0].starts_at).toLocaleDateString('fi-FI', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Extract unique products
    const products = regResult.rows
      .filter(r => r.product_id)
      .reduce((acc, row) => {
        const existing = acc.find(p => p.name === row.name && p.price === row.price);
        if (existing) {
          existing.quantity += row.quantity;
        } else {
          acc.push({
            name: row.name,
            price: parseFloat(row.price),
            quantity: row.quantity
          });
        }
        return acc;
      }, []);

    // Queue cancellation email BEFORE deleting registration (so FK constraint is satisfied)
    try {
      const refundDate = new Date().toLocaleDateString('fi-FI', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      await pool.query(
        `INSERT INTO email_queue (registration_id, email_type, recipient_email, subject, body, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          registrationId,
          'registration_cancellation',
          req.user.email,
          `Registration Cancelled - ${eventTitle}`,
          JSON.stringify({
            userName: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email,
            eventName: eventTitle,
            registrationId,
            refundDate,
            products
          }),
          'pending'
        ]
      );
      console.log('[REGISTRATIONS] Queued cancellation email for registration', registrationId);
    } catch (err) {
      console.error('[REGISTRATIONS] Failed to queue cancellation email:', err.message);
      // Don't block the response - email will be retried
    }

    // Delete the registration
    const result = await pool.query(
      'DELETE FROM registrations WHERE user_id = $1 AND event_id = $2',
      [req.user.id, req.params.eventId]
    );

    res.json({ message: 'Registration cancelled' });
  } catch (err) {
    console.error('Failed to cancel registration:', err.message);
    console.error('Full error:', err);
    res.status(500).json({ error: 'Failed to cancel registration', detail: err.message });
  }
});

// Get registrations for an event (creator, co-manager, admin, or captain)
router.get('/:eventId', requireAuth, async (req, res) => {
  try {
    const event = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.eventId]);
    if (!event.rows[0]) return res.status(404).json({ error: 'Event not found' });

    // Check if user can manage this event (admin, creator, or co-manager)
    const canManage = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);

    if (!canManage) {
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
        COALESCE(u.email, reg_by.email) as email_for_export,
        json_agg(json_build_object(
          'product_id', rp.product_id,
          'name', ep.name,
          'quantity', rp.quantity,
          'price', ep.price,
          'field_values', rp.field_values,
          'fields', ep.fields
        )) FILTER (WHERE rp.id IS NOT NULL) as products
      FROM registrations r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN teams t ON r.team_id = t.id
      LEFT JOIN users reg_by ON r.registered_by = reg_by.id
      LEFT JOIN registration_products rp ON r.id = rp.registration_id
      LEFT JOIN event_products ep ON rp.product_id = ep.id
      WHERE r.event_id = $1
      GROUP BY r.id, u.first_name, u.last_name, u.email, t.name, reg_by.email
      ORDER BY r.created_at ASC
    `, [req.params.eventId]);

    res.json({ registrations: result.rows });
  } catch (err) {
    console.error('Failed to fetch registrations:', err.message);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Cancel any registration (admin, event creator, co-manager, or team captain of the registration's team)
router.delete('/:eventId/registrations/:registrationId', requireAuth, async (req, res) => {
  try {
    const event = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.eventId]);
    if (!event.rows[0]) return res.status(404).json({ error: 'Event not found' });

    // Fetch registration details first to check authorization
    const regCheck = await pool.query(
      'SELECT team_id FROM registrations WHERE id = $1 AND event_id = $2',
      [req.params.registrationId, req.params.eventId]
    );

    if (regCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const registrationTeamId = regCheck.rows[0].team_id;

    // Check authorisation — admin, event creator, co-manager, or captain of the team
    const canManage = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);
    let isAuthorised = canManage;
    let isManagerCancellation = canManage; // Track if cancelled by manager (not captain)

    // Also allow team captains to cancel their team's registrations
    if (!isAuthorised && registrationTeamId) {
      const captainCheck = await pool.query(
        'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2 AND role = $3 AND status = $4',
        [registrationTeamId, req.user.id, 'captain', 'approved']
      );
      isAuthorised = !!captainCheck.rows[0];
      // isManagerCancellation stays false for captain cancellations
    }

    if (!isAuthorised) {
      return res.status(403).json({ error: 'Not authorised to cancel this registration' });
    }

    // Fetch registration details and user info before deleting
    // Handle both regular (with user_id) and guest registrations (without user_id)
    const regResult = await pool.query(
      `SELECT r.id, r.user_id, r.is_guest, r.guest_first_name, r.guest_last_name, r.guest_email,
              u.email, u.first_name, u.last_name,
              e.title, e.starts_at,
              rp.product_id, ep.name, ep.price, rp.quantity
       FROM registrations r
       LEFT JOIN users u ON r.user_id = u.id
       JOIN events e ON r.event_id = e.id
       LEFT JOIN registration_products rp ON r.id = rp.registration_id
       LEFT JOIN event_products ep ON rp.product_id = ep.id
       WHERE r.id = $1 AND r.event_id = $2`,
      [req.params.registrationId, req.params.eventId]
    );

    if (regResult.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Get email and name from either user or guest fields
    const isGuest = regResult.rows[0].is_guest;
    const userEmail = isGuest ? regResult.rows[0].guest_email : regResult.rows[0].email;
    const userName = isGuest
      ? `${regResult.rows[0].guest_first_name || ''} ${regResult.rows[0].guest_last_name || ''}`.trim()
      : `${regResult.rows[0].first_name || ''} ${regResult.rows[0].last_name || ''}`.trim() || regResult.rows[0].email;
    const eventTitle = regResult.rows[0].title;
    const registrationId = regResult.rows[0].id;

    // Extract unique products
    const products = regResult.rows
      .filter(r => r.product_id)
      .reduce((acc, row) => {
        const existing = acc.find(p => p.name === row.name && p.price === row.price);
        if (existing) {
          existing.quantity += row.quantity;
        } else {
          acc.push({
            name: row.name,
            price: parseFloat(row.price),
            quantity: row.quantity
          });
        }
        return acc;
      }, []);

    // Issue refund if cancelled by manager (admin/creator/co-manager)
    let refundAmount = 0;
    if (isManagerCancellation) {
      try {
        // Get the payment intent and amount for this registration
        const paymentResult = await pool.query(
          'SELECT stripe_payment_intent_id, amount_cents FROM payment_intents WHERE registration_id = $1 ORDER BY created_at DESC LIMIT 1',
          [registrationId]
        );

        if (paymentResult.rows[0]) {
          const paymentIntentId = paymentResult.rows[0].stripe_payment_intent_id;
          refundAmount = paymentResult.rows[0].amount_cents;

          // Issue refund through Stripe
          const stripeKey = process.env.STRIPE_SECRET_KEY;
          const stripeInstance = require('stripe')(stripeKey);

          await stripeInstance.refunds.create({
            payment_intent: paymentIntentId,
            amount: refundAmount
          });

          console.log(`[REFUND] Issued €${(refundAmount / 100).toFixed(2)} refund for registration ${registrationId} (manager cancellation)`);
        }
      } catch (err) {
        console.error('[REFUND ERROR] Failed to issue refund:', err.message);
        // Don't fail the cancellation if refund fails - continue with deletion
      }
    }

    // Queue cancellation email BEFORE deleting registration (so FK constraint is satisfied)
    try {
      const refundDate = new Date().toLocaleDateString('fi-FI', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      await pool.query(
        `INSERT INTO email_queue (registration_id, email_type, recipient_email, subject, body, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          registrationId,
          'registration_cancellation',
          userEmail,
          `Registration Cancelled - ${eventTitle}`,
          JSON.stringify({
            userName,
            eventName: eventTitle,
            registrationId,
            refundDate,
            products,
            refundAmount: isManagerCancellation ? refundAmount : 0,
            isCancelledByManager: isManagerCancellation
          }),
          'pending'
        ]
      );
      console.log('[REGISTRATIONS] Queued cancellation email for registration', registrationId);
    } catch (err) {
      console.error('[REGISTRATIONS] Failed to queue cancellation email:', err.message);
      // Don't block the response - email will be retried
    }

    // Delete the registration
    const result = await pool.query(
      'DELETE FROM registrations WHERE id = $1 AND event_id = $2',
      [req.params.registrationId, req.params.eventId]
    );

    res.json({ message: 'Registration cancelled' });
  } catch (err) {
    console.error('Failed to cancel registration:', err.message);
    console.error('Full error:', err);
    res.status(500).json({ error: 'Failed to cancel registration', detail: err.message });
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
          'price', ep.price,
          'field_values', rp.field_values,
          'fields', ep.fields
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
    console.error('[REGISTRATIONS] Failed to fetch my registrations:', err.message);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Update a registration (admin or event creator)
router.put('/:eventId/registrations/:registrationId', requireAuth, async (req, res) => {
  const { guest_first_name, guest_last_name, guest_email, first_name, last_name, email, team_id, products, comments } = req.body;

  const client = await pool.connect();
  try {
    const event = await client.query('SELECT * FROM events WHERE id = $1', [req.params.eventId]);
    if (!event.rows[0]) return res.status(404).json({ error: 'Event not found' });

    const reg = await client.query('SELECT * FROM registrations WHERE id = $1', [req.params.registrationId]);
    if (!reg.rows[0]) return res.status(404).json({ error: 'Registration not found' });

    // Check authorisation — only admin, event creator, or co-manager can edit registrations
    const canManage = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);
    if (!canManage) {
      return res.status(403).json({ error: 'Not authorised to edit registrations' });
    }

    await client.query('BEGIN');

    if (reg.rows[0].is_guest) {
      // Update guest details — only if they're actually provided
      const updateParts = [];
      const params = [];
      let paramIndex = 1;

      if (guest_first_name) {
        updateParts.push(`guest_first_name = $${paramIndex++}`);
        params.push(guest_first_name);
      }
      if (guest_last_name) {
        updateParts.push(`guest_last_name = $${paramIndex++}`);
        params.push(guest_last_name);
      }
      if (guest_email) {
        updateParts.push(`guest_email = $${paramIndex++}`);
        params.push(guest_email);
      }
      if (team_id !== undefined) {
        updateParts.push(`team_id = $${paramIndex++}`);
        params.push(team_id || null);
      }
      if (comments !== undefined) {
        updateParts.push(`comments = $${paramIndex++}`);
        params.push(comments || null);
      }

      if (updateParts.length > 0) {
        params.push(req.params.registrationId);
        await client.query(
          `UPDATE registrations SET ${updateParts.join(', ')} WHERE id = $${paramIndex}`,
          params
        );
      }
    } else {
      // Update registered user details and team
      if (team_id !== undefined) {
        await client.query(
          'UPDATE registrations SET team_id = $1 WHERE id = $2',
          [team_id || null, req.params.registrationId]
        );
      }
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

    // Update comments if provided
    if (comments !== undefined) {
      await client.query(
        'UPDATE registrations SET comments = $1 WHERE id = $2',
        [comments || null, req.params.registrationId]
      );
    }

    // Update products with payment reconciliation
    if (products !== undefined) {
      // Fetch old products before deleting them (for refund email)
      const oldProductsResult = await client.query(
        'SELECT rp.product_id, rp.quantity, rp.field_values, ep.name FROM registration_products rp JOIN event_products ep ON rp.product_id = ep.id WHERE rp.registration_id = $1',
        [req.params.registrationId]
      );
      const oldProducts = oldProductsResult.rows;

      // Calculate old total before deleting products
      const oldTotalCents = await getRegistrationPrice(client, req.params.registrationId);

      // Delete old products
      await client.query('DELETE FROM registration_products WHERE registration_id = $1', [req.params.registrationId]);

      // Insert new products
      if (products.length > 0) {
        await insertProducts(client, req.params.registrationId, products, req.params.eventId);
      }

      // Calculate new total
      const newTotalCents = products.length > 0 ? await calculateProductPrice(client, products, req.params.eventId) : 0;

      // Handle payment reconciliation
      const difference = newTotalCents - oldTotalCents;

      if (difference !== 0) {
        // Get user email
        let userEmail;
        if (reg.rows[0].is_guest) {
          // For guests, use guest_email if available, otherwise use the captain's email (registered_by)
          userEmail = reg.rows[0].guest_email;
          if (!userEmail && reg.rows[0].registered_by) {
            const captainResult = await client.query('SELECT email FROM users WHERE id = $1', [reg.rows[0].registered_by]);
            userEmail = captainResult.rows[0]?.email;
          }
        } else {
          // For regular users, get their email
          const userResult = await client.query('SELECT email FROM users WHERE id = $1', [reg.rows[0].user_id]);
          userEmail = userResult.rows[0]?.email;
        }

        if (difference < 0) {
          // Amount decreased — issue refund
          const refundAmount = Math.abs(difference);

          // Get last payment intent for this registration
          const paymentResult = await client.query(
            'SELECT stripe_payment_intent_id FROM payment_intents WHERE registration_id = $1 ORDER BY created_at DESC LIMIT 1',
            [req.params.registrationId]
          );

          if (paymentResult.rows[0]) {
            let refundIssued = false;
            try {
              const stripeKey = process.env.STRIPE_SECRET_KEY;
              const stripeInstance = require('stripe')(stripeKey);

              // Create refund using payment intent directly (works in both real and mock Stripe)
              await stripeInstance.refunds.create({
                payment_intent: paymentResult.rows[0].stripe_payment_intent_id,
                amount: refundAmount
              });

              console.log(`[REFUND] Issued €${(refundAmount / 100).toFixed(2)} refund for registration ${req.params.registrationId}`);
              refundIssued = true;
            } catch (err) {
              console.error('[REFUND ERROR] Failed to issue refund:', err.message);
              // Don't fail the registration update, continue to send email notification
            }

            // Always send refund notification email when price decreases (whether Stripe refund succeeded or not)
            if (userEmail) {
              try {
                await sendRefundEmail(userEmail, event.rows[0].title, refundAmount, oldProducts, products);
                console.log(`[EMAIL] Sent refund notification to ${userEmail}`);
              } catch (err) {
                console.error('[EMAIL ERROR] Failed to send refund email:', err.message);
                // Don't fail the registration update if email fails
              }
            } else {
              console.warn('[EMAIL] No email address available for refund notification');
            }
          }
        } else if (difference > 0) {
          // Amount increased — create new payment intent for the difference
          if (!userEmail) {
            return res.status(400).json({ error: 'Cannot add products: guest email is missing. Please update the guest email first.' });
          }

          try {
            const newPaymentIntent = await stripe.createPaymentIntent(
              req.params.registrationId,
              difference,
              userEmail
            );

            // Store the additional payment intent info
            await client.query(
              'INSERT INTO payment_intents (stripe_payment_intent_id, registration_id, amount_cents, currency, status) VALUES ($1, $2, $3, $4, $5)',
              [newPaymentIntent.id, req.params.registrationId, difference, 'eur', newPaymentIntent.status]
            );

            // Update payment status to indicate additional payment is pending
            await client.query(
              'UPDATE registrations SET payment_status = $1 WHERE id = $2',
              ['additional_payment_pending', req.params.registrationId]
            );

            console.log(`[PAYMENT] Created additional payment intent for €${(difference / 100).toFixed(2)} for registration ${req.params.registrationId}`);

            // Send email notification about additional payment
            try {
              await sendAdditionalPaymentEmail(
                userEmail,
                event.rows[0].title,
                difference,
                newPaymentIntent.client_secret,
                newPaymentIntent.id
              );
              console.log(`[EMAIL] Sent additional payment notification to ${userEmail}`);
            } catch (err) {
              console.error('[EMAIL ERROR] Failed to send additional payment email:', err.message);
              // Don't fail the registration update if email fails
            }
          } catch (err) {
            console.error('[PAYMENT ERROR] Failed to create additional payment intent:', err.message);
            throw new Error(`Failed to process additional payment: ${err.message}`);
          }
        }
      }
    }

    await client.query('COMMIT');

    // Return updated registration
    const updated = await pool.query(`
      SELECT
        r.id, r.user_id, r.event_id, r.team_id, r.is_guest, r.guest_first_name, r.guest_last_name, r.guest_email,
        r.comments, r.payment_status, r.created_at, r.registered_by,
        u.first_name, u.last_name, u.email as user_email,
        t.name as team_name,
        json_agg(json_build_object(
          'product_id', rp.product_id,
          'name', ep.name,
          'quantity', rp.quantity,
          'price', ep.price,
          'field_values', rp.field_values,
          'fields', ep.fields
        )) FILTER (WHERE rp.id IS NOT NULL) as products
      FROM registrations r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN teams t ON r.team_id = t.id
      LEFT JOIN registration_products rp ON r.id = rp.registration_id
      LEFT JOIN event_products ep ON rp.product_id = ep.id
      WHERE r.id = $1
      GROUP BY r.id, u.first_name, u.last_name, u.email, t.name
    `, [req.params.registrationId]);

    // Calculate total price of updated registration for response
    const finalTotalCents = updated.rows[0].products && updated.rows[0].products.length > 0
      ? await calculateProductPrice(client,
          updated.rows[0].products.map(p => ({
            product_id: p.product_id,
            quantity: p.quantity,
            field_values: p.field_values
          })),
          req.params.eventId
        )
      : 0;

    // Ensure products is always an array, not null
    const registration = updated.rows[0];
    if (registration && !Array.isArray(registration.products)) {
      registration.products = [];
    }

    res.json({
      registration: registration,
      paymentInfo: {
        totalCents: finalTotalCents,
        totalEur: (finalTotalCents / 100).toFixed(2)
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to update registration:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update registration' });
  } finally {
    client.release();
  }
});

module.exports = router;
