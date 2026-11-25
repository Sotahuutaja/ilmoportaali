/**
 * Shared pricing logic for products with priced field options.
 *
 * A product has a base price, which can be overridden by two kinds of custom fields:
 *
 * - 'select' (dropdown) — if the registrant chose an option that carries its own `price`,
 *   that single price REPLACES the product's base price.
 * - 'checkbox' (checkbox list) — if ANY option in the field carries a `price`, the field is
 *   "priced": the product has no base price of its own for it, and the SUM of the checked
 *   options' prices (checked options with no price contribute €0) REPLACES the price outright
 *   — including replacing it with €0 if nothing priced ends up checked. A checkbox field
 *   with no priced options at all keeps the original behavior of never affecting price
 *   (see ../utils/checkboxFields.js for the min/max-selection and stock-limit rules, which
 *   are unaffected by this).
 *
 * If a product somehow has both a priced select field and a priced checkbox field, the
 * checkbox sum wins (it's evaluated after, and replaces, the select override) — a rare
 * combination, but the rule is deterministic rather than depending on field order.
 *
 * This is the single source of truth for all of this. Every place that needs a product's
 * effective price — checkout, registration, refunds, confirmation/cancellation emails,
 * admin edit forms — should call resolvePrice() rather than re-implementing the "find the
 * selected option(s), check for a price override" logic. Previously this logic was
 * copy-pasted independently in ~12 places across registrations.js, payments.js and
 * emailWorker.js, which made it easy for a fix or a rule change to land in some call sites
 * and not others.
 *
 * @param {number|string} basePrice - the product's base price (event_products.price)
 * @param {Array} fields - the product's field definitions (event_products.fields)
 * @param {object} fieldValues - the registrant's chosen values, keyed by field.id
 * @returns {number} the effective unit price, in euros
 */
function resolvePrice(basePrice, fields, fieldValues) {
  let price = parseFloat(basePrice) || 0;
  const fieldList = fields || [];
  const values = fieldValues || {};

  // 'select' fields: the chosen option's price, if set, replaces the base price.
  for (const field of fieldList) {
    if (field.type !== 'select') continue;

    const selectedValue = values[field.id];
    if (!selectedValue || !field.options) continue;

    const option = field.options.find(opt => {
      const optVal = typeof opt === 'string' ? opt : opt.value;
      return optVal === selectedValue;
    });

    if (option && typeof option === 'object' && option.price !== null && option.price !== undefined) {
      price = parseFloat(option.price);
      break;
    }
  }

  // 'checkbox' fields: any field with at least one priced option is a "priced" field — the
  // sum of its checked options' prices replaces the price computed above outright.
  let checkboxOverrideApplies = false;
  let checkboxSum = 0;

  for (const field of fieldList) {
    if (field.type !== 'checkbox' || !field.options) continue;

    const isPricedField = field.options.some(opt =>
      typeof opt === 'object' && opt.price !== null && opt.price !== undefined
    );
    if (!isPricedField) continue;

    checkboxOverrideApplies = true;
    const selected = Array.isArray(values[field.id]) ? values[field.id] : [];

    for (const opt of field.options) {
      if (typeof opt !== 'object' || !selected.includes(opt.value)) continue;
      if (opt.price !== null && opt.price !== undefined) {
        checkboxSum += parseFloat(opt.price);
      }
    }
  }

  if (checkboxOverrideApplies) {
    price = checkboxSum;
  }

  return price;
}

/**
 * Prefer the price actually recorded at the moment a product was added to a registration
 * (registration_products.product_price, snapshotted by every insert path — see payments.js
 * and registrations.js's insertProducts()) over resolvePrice()'s live recomputation against
 * the product's *current* configuration.
 *
 * Without this, any place that displays or refunds an already-purchased product keeps
 * re-deriving its price from whatever the product looks like today — so editing a
 * product's fields or prices after people have already registered silently rewrites
 * history for every past registrant too (showing, or even refunding, an amount that has
 * nothing to do with what they actually paid).
 *
 * Only falls back to a live resolvePrice() call for rows that predate this column being
 * populated on every purchase (product_price is NULL) — there's no way to recover what an
 * older purchase actually cost once the product's configuration has since changed, so this
 * is a best-effort fallback for pre-existing data, not a guarantee.
 *
 * @param {object} row - a registration_products row (or anything shaped like one), with
 *   `product_price` (the snapshot, possibly null) and `price` (the product's current base
 *   price, used only as a fallback)
 * @param {Array} fields - the product's field definitions to fall back to resolvePrice()
 *   with (ideally the product's *current* fields, since no historical snapshot of fields
 *   themselves is kept)
 * @param {object} fieldValues - the registrant's chosen values, keyed by field.id
 * @returns {number} the effective unit price, in euros
 */
function purchasedPrice(row, fields, fieldValues) {
  if (row.product_price !== null && row.product_price !== undefined) {
    return parseFloat(row.product_price);
  }
  return resolvePrice(row.price, fields, fieldValues);
}

module.exports = { resolvePrice, purchasedPrice };
