/**
 * Volunteer discount pricing layer.
 *
 * This sits ON TOP of resolvePrice() (see ./pricing.js) rather than inside it —
 * resolvePrice() only ever needs to know about a product's own configuration and the
 * registrant's field selections, never about who the registrant is. Volunteer eligibility
 * is a separate concern: it depends on the registering user's approved volunteer roles for
 * the event, which resolvePrice() has no business knowing about.
 *
 * Usage at a call site that already has a "listed" price from resolvePrice():
 *
 *   const discounts = await getVolunteerDiscountMap(client, userId, eventId);
 *   const finalPrice = applyVolunteerDiscount(listedPrice, discounts.get(product_id));
 *
 * Guest registrations must never receive a discount here — callers should simply not call
 * getVolunteerDiscountMap for a guest (there is no independent user_id to look up), or pass
 * a null/undefined userId, which short-circuits to an empty map.
 */

/**
 * Fetches every product discount rule attached to any role the user holds an APPROVED
 * application for at this event, grouped by product_id. A user can hold multiple
 * approved roles at once, and more than one of them can carry a rule for the same
 * product — all candidate rules for a product are kept (not deduplicated down to one),
 * so applyVolunteerDiscount() can pick whichever is most favorable to the registrant
 * once it knows the actual listed price.
 *
 * @param {import('pg').Pool|import('pg').PoolClient} client
 * @param {number|null|undefined} userId
 * @param {number|string} eventId
 * @returns {Promise<Map<number, Array<{discount_type: string, discount_value: number|null, role_id: number, role_name: string}>>>}
 */
async function getVolunteerDiscountMap(client, userId, eventId) {
  const map = new Map();
  if (!userId || !eventId) return map;

  const result = await client.query(`
    SELECT vpd.product_id, vpd.discount_type, vpd.discount_value, vr.id as role_id, vr.name as role_name
    FROM event_volunteers ev
    JOIN volunteer_roles vr ON vr.id = ev.role_id
    JOIN volunteer_product_discounts vpd ON vpd.role_id = ev.role_id
    WHERE ev.event_id = $1 AND ev.user_id = $2 AND ev.status = 'approved'
  `, [eventId, userId]);

  for (const row of result.rows) {
    const list = map.get(row.product_id) || [];
    list.push({
      discount_type: row.discount_type,
      discount_value: row.discount_value !== null ? parseFloat(row.discount_value) : null,
      role_id: row.role_id,
      role_name: row.role_name
    });
    map.set(row.product_id, list);
  }

  return map;
}

/**
 * Applies whichever of the given candidate discounts is most favorable to the registrant,
 * given the price resolvePrice() already computed from the product's own configuration.
 * Never returns a price below €0. Returns the unchanged price if there are no candidates.
 *
 * @param {number} listedPrice - the price resolvePrice() already computed for this unit
 * @param {Array<{discount_type: string, discount_value: number|null}>|undefined} candidates
 * @returns {number}
 */
function applyVolunteerDiscount(listedPrice, candidates) {
  if (!candidates || candidates.length === 0) return listedPrice;

  let best = listedPrice;
  for (const discount of candidates) {
    const candidatePrice = computeDiscountedPrice(listedPrice, discount);
    if (candidatePrice < best) best = candidatePrice;
  }
  return best;
}

function computeDiscountedPrice(listedPrice, discount) {
  const value = discount.discount_value !== null && discount.discount_value !== undefined
    ? parseFloat(discount.discount_value)
    : 0;

  switch (discount.discount_type) {
    case 'free':
      return 0;
    case 'override_price':
      return Math.max(0, value);
    case 'percent':
      return Math.max(0, listedPrice * (1 - value / 100));
    case 'fixed_amount':
      return Math.max(0, listedPrice - value);
    default:
      return listedPrice;
  }
}

const DISCOUNT_TYPES = ['free', 'percent', 'fixed_amount', 'override_price'];

module.exports = { getVolunteerDiscountMap, applyVolunteerDiscount, DISCOUNT_TYPES };
