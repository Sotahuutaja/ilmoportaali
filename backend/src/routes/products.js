const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router({ mergeParams: true });
const { canManageEvent } = require('../utils/eventAccess');

// Get products for an event (public)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
        COALESCE(p.quantity - SUM(rp.quantity) FILTER (WHERE rp.id IS NOT NULL), p.quantity) as remaining
      FROM event_products p
      LEFT JOIN registration_products rp ON p.id = rp.product_id
      WHERE p.event_id = $1
      GROUP BY p.id, p.event_id, p.name, p.description, p.price, p.quantity, p.created_at, p.sort_order, p.fields
      ORDER BY p.sort_order ASC, p.name ASC
    `, [req.params.eventId]);
    res.json({ products: result.rows });
  } catch (err) {
    console.error('Failed to fetch products:', err.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create product (creator who owns event, or admin)
router.post('/', requireAuth, requireRole('creator', 'admin'), async (req, res) => {
  const { name, description, price, quantity, fields = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'Product name is required' });

  try {
    const event = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.eventId]);
    if (!event.rows[0]) return res.status(404).json({ error: 'Event not found' });

    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised to manage this event' });

    const result = await pool.query(
      'INSERT INTO event_products (event_id, name, description, price, quantity, fields) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.params.eventId, name, description, price || 0, quantity || null, JSON.stringify(fields)]
    );
    res.status(201).json({ product: result.rows[0] });
  } catch (err) {
    console.error('Failed to create product:', err.message);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Reorder products
router.put('/reorder', requireAuth, requireRole('creator', 'admin'), async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });

  const allowed = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);
  if (!allowed) return res.status(403).json({ error: 'Not authorised' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < order.length; i++) {
      await client.query(
        'UPDATE event_products SET sort_order = $1 WHERE id = $2 AND event_id = $3',
        [i, order[i], req.params.eventId]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Order updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to reorder products:', err.message);
    res.status(500).json({ error: 'Failed to reorder products' });
  } finally {
    client.release();
  }
});

// Update product
router.put('/:productId', requireAuth, requireRole('creator', 'admin'), async (req, res) => {
  const { name, description, price, quantity, fields = [] } = req.body;

  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised' });

    const result = await pool.query(`
      UPDATE event_products SET name=$1, description=$2, price=$3, quantity=$4, fields=$5
      WHERE id=$6 AND event_id=$7 RETURNING *
    `, [name, description, price, quantity || null, JSON.stringify(fields), req.params.productId, req.params.eventId]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: result.rows[0] });
  } catch (err) {
    console.error('Failed to update product:', err.message);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
router.delete('/:productId', requireAuth, requireRole('creator', 'admin'), async (req, res) => {
  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised' });

    await pool.query('DELETE FROM event_products WHERE id=$1 AND event_id=$2', [req.params.productId, req.params.eventId]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Failed to delete product:', err.message);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});


module.exports = router;
