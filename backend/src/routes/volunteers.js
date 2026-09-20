/**
 * Volunteer management for an event: organizer-defined roles with per-product
 * discounts/benefits, and user applications to those roles that must be approved before
 * any benefit applies. Mounted at /api/events/:eventId/volunteers (mergeParams), mirroring
 * routes/products.js.
 *
 * The events.volunteering_enabled flag is enforced here (new applications are rejected
 * when it's off) — it's a data-entry gate, not a visibility one: organizers can still see
 * and manage existing roles, discounts and applications, and already-approved volunteers
 * keep their benefits, regardless of the flag's current value.
 */
const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router({ mergeParams: true });
const { canManageEvent } = require('../utils/eventAccess');
const { logHelpers } = require('../services/logService');
const { DISCOUNT_TYPES } = require('../utils/volunteerPricing');

function isValidDiscount(discount_type, discount_value) {
  if (!DISCOUNT_TYPES.includes(discount_type)) return false;
  if (discount_type === 'free') return true;
  return discount_value !== null && discount_value !== undefined && !isNaN(parseFloat(discount_value));
}

// --- Roles (public read, organizer write) --------------------------------------------

// List roles for this event, including their discount rules and current approved count
// (used both by the public "volunteer for this event" apply UI and the organizer's
// management screen).
router.get('/roles', async (req, res) => {
  try {
    const roles = await pool.query(`
      SELECT vr.*,
        (SELECT COUNT(*)::integer FROM event_volunteers ev WHERE ev.role_id = vr.id AND ev.status = 'approved') as approved_count
      FROM volunteer_roles vr
      WHERE vr.event_id = $1
      ORDER BY vr.created_at ASC
    `, [req.params.eventId]);

    const discounts = await pool.query(`
      SELECT vpd.* FROM volunteer_product_discounts vpd
      JOIN volunteer_roles vr ON vr.id = vpd.role_id
      WHERE vr.event_id = $1
    `, [req.params.eventId]);

    const rolesWithDiscounts = roles.rows.map(role => ({
      ...role,
      discounts: discounts.rows.filter(d => d.role_id === role.id)
    }));

    res.json({ roles: rolesWithDiscounts });
  } catch (err) {
    console.error('Failed to fetch volunteer roles:', err.message);
    res.status(500).json({ error: 'Failed to fetch volunteer roles' });
  }
});

// Create a role (organizer/admin only)
router.post('/roles', requireAuth, async (req, res) => {
  const { name, description, capacity } = req.body;
  if (!name) return res.status(400).json({ error: 'Role name is required' });

  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised to manage volunteers for this event' });

    const result = await pool.query(
      `INSERT INTO volunteer_roles (event_id, name, description, capacity)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.eventId, name, description || null, capacity ? parseInt(capacity) : null]
    );

    logHelpers.volunteerRoleCreated(result.rows[0].id, name, req.params.eventId, req.user.id);

    res.status(201).json({ role: { ...result.rows[0], discounts: [], approved_count: 0 } });
  } catch (err) {
    console.error('Failed to create volunteer role:', err.message);
    res.status(500).json({ error: 'Failed to create volunteer role' });
  }
});

// Update a role (organizer/admin only)
router.put('/roles/:roleId', requireAuth, async (req, res) => {
  const { name, description, capacity } = req.body;
  if (!name) return res.status(400).json({ error: 'Role name is required' });

  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised to manage volunteers for this event' });

    const result = await pool.query(
      `UPDATE volunteer_roles SET name = $1, description = $2, capacity = $3
       WHERE id = $4 AND event_id = $5 RETURNING *`,
      [name, description || null, capacity ? parseInt(capacity) : null, req.params.roleId, req.params.eventId]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Role not found' });

    logHelpers.volunteerRoleUpdated(result.rows[0].id, name, req.params.eventId, req.user.id);

    res.json({ role: result.rows[0] });
  } catch (err) {
    console.error('Failed to update volunteer role:', err.message);
    res.status(500).json({ error: 'Failed to update volunteer role' });
  }
});

// Delete a role (organizer/admin only) — blocked while it still has approved volunteers,
// the same way an event can't be deleted out from under active registrations, so an
// organizer can't silently revoke benefits someone is already relying on.
router.delete('/roles/:roleId', requireAuth, async (req, res) => {
  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised to manage volunteers for this event' });

    const existing = await pool.query(
      'SELECT * FROM volunteer_roles WHERE id = $1 AND event_id = $2',
      [req.params.roleId, req.params.eventId]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Role not found' });

    const approved = await pool.query(
      `SELECT COUNT(*)::integer as count FROM event_volunteers WHERE role_id = $1 AND status = 'approved'`,
      [req.params.roleId]
    );
    if (approved.rows[0].count > 0) {
      return res.status(409).json({
        error: 'Cannot delete a role with approved volunteers. Reject or reassign them first so their benefits aren\'t silently revoked.',
        approvedCount: approved.rows[0].count
      });
    }

    await pool.query('DELETE FROM volunteer_roles WHERE id = $1', [req.params.roleId]);

    logHelpers.volunteerRoleDeleted(req.params.roleId, existing.rows[0].name, req.params.eventId, req.user.id);

    res.json({ message: 'Role deleted' });
  } catch (err) {
    console.error('Failed to delete volunteer role:', err.message);
    res.status(500).json({ error: 'Failed to delete volunteer role' });
  }
});

// --- Per-role, per-product discounts (organizer only) ---------------------------------

// Create or update the discount rule a role carries for a given product.
router.post('/roles/:roleId/discounts', requireAuth, async (req, res) => {
  const { product_id, discount_type, discount_value } = req.body;

  if (!product_id) return res.status(400).json({ error: 'product_id is required' });
  if (!isValidDiscount(discount_type, discount_value)) {
    return res.status(400).json({ error: `discount_type must be one of ${DISCOUNT_TYPES.join(', ')}, and discount_value is required unless discount_type is "free"` });
  }

  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised to manage volunteers for this event' });

    const role = await pool.query(
      'SELECT * FROM volunteer_roles WHERE id = $1 AND event_id = $2',
      [req.params.roleId, req.params.eventId]
    );
    if (!role.rows[0]) return res.status(404).json({ error: 'Role not found' });

    const product = await pool.query(
      'SELECT name FROM event_products WHERE id = $1 AND event_id = $2',
      [product_id, req.params.eventId]
    );
    if (!product.rows[0]) return res.status(404).json({ error: 'Product not found for this event' });

    const value = discount_type === 'free' ? null : parseFloat(discount_value);

    const result = await pool.query(
      `INSERT INTO volunteer_product_discounts (role_id, product_id, discount_type, discount_value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (role_id, product_id) DO UPDATE SET discount_type = $3, discount_value = $4
       RETURNING *`,
      [req.params.roleId, product_id, discount_type, value]
    );

    logHelpers.volunteerDiscountSet(req.params.roleId, role.rows[0].name, product.rows[0].name, discount_type, req.params.eventId, req.user.id);

    res.status(201).json({ discount: result.rows[0] });
  } catch (err) {
    console.error('Failed to set volunteer discount:', err.message);
    res.status(500).json({ error: 'Failed to set volunteer discount' });
  }
});

// Remove a role's discount rule for a given product.
router.delete('/roles/:roleId/discounts/:productId', requireAuth, async (req, res) => {
  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised to manage volunteers for this event' });

    const result = await pool.query(
      `DELETE FROM volunteer_product_discounts vpd USING volunteer_roles vr
       WHERE vpd.role_id = vr.id AND vr.event_id = $1 AND vpd.role_id = $2 AND vpd.product_id = $3
       RETURNING vpd.id`,
      [req.params.eventId, req.params.roleId, req.params.productId]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Discount rule not found' });

    res.json({ message: 'Discount rule removed' });
  } catch (err) {
    console.error('Failed to remove volunteer discount:', err.message);
    res.status(500).json({ error: 'Failed to remove volunteer discount' });
  }
});

// --- Applications (self-service for applicants, review for organizers) ---------------

// The current user's own applications for this event.
router.get('/my-applications', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ev.*, vr.name as role_name
      FROM event_volunteers ev
      JOIN volunteer_roles vr ON vr.id = ev.role_id
      WHERE ev.event_id = $1 AND ev.user_id = $2
      ORDER BY ev.applied_at ASC
    `, [req.params.eventId, req.user.id]);
    res.json({ applications: result.rows });
  } catch (err) {
    console.error('Failed to fetch your volunteer applications:', err.message);
    res.status(500).json({ error: 'Failed to fetch your volunteer applications' });
  }
});

// Apply to a role. Blocked once volunteering has been turned off for this event, and
// guests can never apply since applications are tied to a real user account.
router.post('/apply', requireAuth, async (req, res) => {
  const { role_id } = req.body;
  if (!role_id) return res.status(400).json({ error: 'role_id is required' });

  try {
    const event = await pool.query('SELECT volunteering_enabled FROM events WHERE id = $1', [req.params.eventId]);
    if (!event.rows[0]) return res.status(404).json({ error: 'Event not found' });
    if (!event.rows[0].volunteering_enabled) {
      return res.status(409).json({ error: 'This event is not accepting volunteer applications' });
    }

    const role = await pool.query(
      'SELECT * FROM volunteer_roles WHERE id = $1 AND event_id = $2',
      [role_id, req.params.eventId]
    );
    if (!role.rows[0]) return res.status(404).json({ error: 'Role not found for this event' });

    const result = await pool.query(
      `INSERT INTO event_volunteers (event_id, user_id, role_id, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (event_id, user_id, role_id) DO NOTHING
       RETURNING *`,
      [req.params.eventId, req.user.id, role_id]
    );

    if (!result.rows[0]) {
      return res.status(409).json({ error: 'You have already applied for this role' });
    }

    logHelpers.volunteerApplicationSubmitted(result.rows[0].id, role.rows[0].name, req.params.eventId, req.user.id);

    res.status(201).json({ application: { ...result.rows[0], role_name: role.rows[0].name } });
  } catch (err) {
    console.error('Failed to submit volunteer application:', err.message);
    res.status(500).json({ error: 'Failed to submit volunteer application' });
  }
});

// Withdraw your own application (pending or already-approved) for a role.
router.delete('/apply/:roleId', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM event_volunteers WHERE event_id = $1 AND user_id = $2 AND role_id = $3 RETURNING id`,
      [req.params.eventId, req.user.id, req.params.roleId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Application not found' });

    logHelpers.volunteerApplicationWithdrawn(req.params.roleId, req.params.eventId, req.user.id);

    res.json({ message: 'Application withdrawn' });
  } catch (err) {
    console.error('Failed to withdraw volunteer application:', err.message);
    res.status(500).json({ error: 'Failed to withdraw volunteer application' });
  }
});

// List every application for this event (organizer/admin only).
router.get('/applications', requireAuth, async (req, res) => {
  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised to manage volunteers for this event' });

    const result = await pool.query(`
      SELECT ev.*, vr.name as role_name, u.first_name, u.last_name, u.email
      FROM event_volunteers ev
      JOIN volunteer_roles vr ON vr.id = ev.role_id
      JOIN users u ON u.id = ev.user_id
      WHERE ev.event_id = $1
      ORDER BY ev.applied_at ASC
    `, [req.params.eventId]);

    res.json({ applications: result.rows });
  } catch (err) {
    console.error('Failed to fetch volunteer applications:', err.message);
    res.status(500).json({ error: 'Failed to fetch volunteer applications' });
  }
});

// Approve an application (organizer/admin only). Blocked once the role's capacity
// (if set) is already met by other approved volunteers.
router.put('/applications/:appId/approve', requireAuth, async (req, res) => {
  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised to manage volunteers for this event' });

    const application = await pool.query(
      `SELECT ev.*, vr.name as role_name, vr.capacity FROM event_volunteers ev
       JOIN volunteer_roles vr ON vr.id = ev.role_id
       WHERE ev.id = $1 AND ev.event_id = $2`,
      [req.params.appId, req.params.eventId]
    );
    if (!application.rows[0]) return res.status(404).json({ error: 'Application not found' });

    const app = application.rows[0];

    if (app.capacity !== null && app.status !== 'approved') {
      const approvedCount = await pool.query(
        `SELECT COUNT(*)::integer as count FROM event_volunteers WHERE role_id = $1 AND status = 'approved'`,
        [app.role_id]
      );
      if (approvedCount.rows[0].count >= app.capacity) {
        return res.status(409).json({ error: `This role is already full (${app.capacity} volunteer(s))` });
      }
    }

    const result = await pool.query(
      `UPDATE event_volunteers SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.appId]
    );

    logHelpers.volunteerApplicationApproved(app.id, app.role_name, app.event_id, app.user_id, req.user.id);

    res.json({ application: result.rows[0] });
  } catch (err) {
    console.error('Failed to approve volunteer application:', err.message);
    res.status(500).json({ error: 'Failed to approve volunteer application' });
  }
});

// Reject an application (organizer/admin only). Kept as a record rather than deleted.
router.put('/applications/:appId/reject', requireAuth, async (req, res) => {
  const { notes } = req.body;
  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised to manage volunteers for this event' });

    const application = await pool.query(
      `SELECT ev.*, vr.name as role_name FROM event_volunteers ev
       JOIN volunteer_roles vr ON vr.id = ev.role_id
       WHERE ev.id = $1 AND ev.event_id = $2`,
      [req.params.appId, req.params.eventId]
    );
    if (!application.rows[0]) return res.status(404).json({ error: 'Application not found' });

    const result = await pool.query(
      `UPDATE event_volunteers SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), notes = $2
       WHERE id = $3 RETURNING *`,
      [req.user.id, notes || null, req.params.appId]
    );

    logHelpers.volunteerApplicationRejected(application.rows[0].id, application.rows[0].role_name, application.rows[0].event_id, application.rows[0].user_id, req.user.id);

    res.json({ application: result.rows[0] });
  } catch (err) {
    console.error('Failed to reject volunteer application:', err.message);
    res.status(500).json({ error: 'Failed to reject volunteer application' });
  }
});

module.exports = router;
