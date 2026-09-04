/**
 * Shared validation for "identifying" products (e.g. event tickets) — products flagged
 * event_products.is_identifying, which represent one person's registration/attendance.
 * At most one such product (summed by quantity) may be claimed per registration, so that
 * a single registration can never silently stand in for more than one attendee.
 *
 * This is used by every place that inserts products for a registration: the free
 * self/guest registration endpoints and admin edits (registrations.js), and the paid
 * checkout flow (payments.js). Keeping it in one place means the rule can't drift out of
 * sync between those paths the way it once did.
 */

/**
 * Sum the quantity of identifying products in a product selection and reject if more
 * than one is being claimed. Returns the summed quantity so callers can also use it to
 * decide whether a registration should count toward event capacity.
 * @param {object} client - pg client/pool with an active (or no) transaction
 * @param {Array<{product_id: number, quantity?: number}>} products
 * @param {number} eventId
 * @returns {Promise<number>} total quantity claimed across identifying products (0 or 1 if valid)
 */
async function validateIdentifyingProducts(client, products, eventId) {
  if (!products || products.length === 0) return 0;

  const productIds = products.map(p => p.product_id);
  const result = await client.query(
    'SELECT id FROM event_products WHERE id = ANY($1) AND event_id = $2 AND is_identifying = TRUE',
    [productIds, eventId]
  );
  const identifyingIds = new Set(result.rows.map(r => r.id));

  let identifyingQuantity = 0;
  for (const { product_id, quantity = 1 } of products) {
    if (identifyingIds.has(product_id)) {
      identifyingQuantity += quantity;
    }
  }

  if (identifyingQuantity > 1) {
    throw new Error('Only one ticket-type product can be selected per registration');
  }

  return identifyingQuantity;
}

/**
 * Count how many of an event's registrations currently claim an active identifying
 * product — i.e. how many capacity slots are in use. Merch-only registrations (no
 * identifying product) don't consume a slot and aren't counted.
 *
 * Used both to decide whether a *new* registration would push an event over capacity
 * (registrations.js, payments.js) and to report the "how full is this event" count shown
 * in the UI (events.js) — kept as one query so those two things can't drift apart either.
 * @param {object} client - pg client/pool
 * @param {number} eventId
 * @returns {Promise<number>}
 */
async function countIdentifyingRegistrations(client, eventId) {
  const result = await client.query(`
    SELECT COUNT(DISTINCT r.id)::integer AS count
    FROM registrations r
    JOIN registration_products rp ON rp.registration_id = r.id AND rp.deleted_at IS NULL
    JOIN event_products ep ON ep.id = rp.product_id AND ep.is_identifying = TRUE
    WHERE r.event_id = $1
  `, [eventId]);
  return result.rows[0].count;
}

module.exports = { validateIdentifyingProducts, countIdentifyingRegistrations };
