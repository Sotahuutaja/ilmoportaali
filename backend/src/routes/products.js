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
        CASE
          WHEN p.quantity IS NOT NULL THEN
            p.quantity - COALESCE((
              SELECT SUM(rp.quantity)
              FROM registration_products rp
              JOIN registrations r ON rp.registration_id = r.id
              WHERE rp.product_id = p.id AND r.event_id = p.event_id
            ), 0)
          ELSE NULL
        END as remaining
      FROM event_products p
      WHERE p.event_id = $1
      ORDER BY p.sort_order ASC, p.name ASC
    `, [req.params.eventId]);

    // Process products to calculate per-option remaining quantities
    const productsWithRemaining = await Promise.all(result.rows.map(async (product) => {
      const productCopy = { ...product };

      // If product has fields with options that have quantity limits
      if (productCopy.fields && Array.isArray(productCopy.fields)) {
        const fieldsWithRemaining = await Promise.all(
          productCopy.fields.map(async (field) => {
            const fieldCopy = { ...field };

            // If this is a select field with options that have quantity limits
            if (field.type === 'select' && field.options && Array.isArray(field.options)) {
              fieldCopy.options = await Promise.all(
                field.options.map(async (option) => {
                  const optionCopy = typeof option === 'string' ? option : { ...option };

                  // If option has a quantity limit, calculate remaining
                  if (optionCopy && typeof optionCopy === 'object' && optionCopy.quantity !== null && optionCopy.quantity !== undefined) {
                    // Count how many registrations selected this option
                    // First, let's get all field_values to debug
                    const allRegistrations = await pool.query(`
                      SELECT rp.field_values
                      FROM registration_products rp
                      JOIN registrations r ON rp.registration_id = r.id
                      WHERE rp.product_id = $1 AND r.event_id = $2
                    `, [product.id, req.params.eventId]);

                    console.log(`[PRODUCTS-DEBUG] All registrations for product ${product.id}: ${JSON.stringify(allRegistrations.rows)}`);

                    // Try multiple LIKE patterns
                    const likePatterns = [
                      `%"${field.id}":"${optionCopy.value}"%`,
                      `%"${field.id}" : "${optionCopy.value}"%`,
                      `%"${field.id}": "${optionCopy.value}"%`
                    ];

                    const countResult = await pool.query(`
                      SELECT COUNT(*) as count
                      FROM registration_products rp
                      JOIN registrations r ON rp.registration_id = r.id
                      WHERE rp.product_id = $1
                        AND r.event_id = $2
                        AND (
                          rp.field_values::text LIKE $3
                          OR rp.field_values::text LIKE $4
                          OR rp.field_values::text LIKE $5
                        )
                    `, [product.id, req.params.eventId, ...likePatterns]);

                    const used = parseInt(countResult.rows[0]?.count || 0);
                    optionCopy.remaining = optionCopy.quantity - used;
                    console.log(`[PRODUCTS-DEBUG] Option "${optionCopy.value}" (field "${field.id}"): limit=${optionCopy.quantity}, used=${used}, remaining=${optionCopy.remaining}`);
                  }

                  return optionCopy;
                })
              );
            }

            return fieldCopy;
          })
        );
        productCopy.fields = fieldsWithRemaining;
      }

      return productCopy;
    }));

    // Debug logging
    console.log(`[PRODUCTS] Event ${req.params.eventId} has ${productsWithRemaining.length} products`);
    productsWithRemaining.forEach(p => {
      console.log(`[PRODUCTS] Product: ${p.name} (id=${p.id})`);
      if (p.fields) {
        p.fields.forEach(f => {
          if (f.type === 'select' && f.options) {
            f.options.forEach(opt => {
              if (typeof opt === 'object' && opt.remaining !== undefined) {
                console.log(`[PRODUCTS]   Option: ${opt.value}, remaining=${opt.remaining}`);
              }
            });
          }
        });
      }
    });

    res.json({ products: productsWithRemaining });
  } catch (err) {
    console.error('Failed to fetch products:', err.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create product (creator who owns event, or admin)
router.post('/', requireAuth, requireRole(pool, 'creator', 'admin'), async (req, res) => {
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
router.put('/reorder', requireAuth, requireRole(pool, 'creator', 'admin'), async (req, res) => {
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
router.put('/:productId', requireAuth, requireRole(pool, 'creator', 'admin'), async (req, res) => {
  const { name, description, price, quantity, fields = [] } = req.body;

  try {
    const allowed = await canManageEvent(req.user.id, req.user.role, req.params.eventId, pool);
    if (!allowed) return res.status(403).json({ error: 'Not authorised' });

    const result = await pool.query(`
      UPDATE event_products SET name=$1, description=$2, price=$3, quantity=$4, fields=$5
      WHERE id=$6 AND event_id=$7 RETURNING *
    `, [name, description, price, quantity || null, JSON.stringify(fields), req.params.productId, req.params.eventId]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });

    // Fetch the product with remaining quantity calculated
    const withRemaining = await pool.query(`
      SELECT p.*,
        COALESCE(p.quantity - (
          SELECT COALESCE(SUM(rp.quantity), 0)
          FROM registration_products rp
          JOIN registrations r ON rp.registration_id = r.id
          WHERE rp.product_id = p.id AND r.event_id = p.event_id
        ), p.quantity) as remaining
      FROM event_products p
      WHERE p.id = $1 AND p.event_id = $2
    `, [req.params.productId, req.params.eventId]);

    res.json({ product: withRemaining.rows[0] });
  } catch (err) {
    console.error('Failed to update product:', err.message);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
router.delete('/:productId', requireAuth, requireRole(pool, 'creator', 'admin'), async (req, res) => {
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
