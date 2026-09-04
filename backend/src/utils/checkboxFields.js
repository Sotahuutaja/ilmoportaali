/**
 * Shared validation for "checkbox list" custom fields — a field where a registrant can
 * check between field.minSelect and field.maxSelect of the listed options (each option is
 * just a label, not a price: the product's price never changes based on how many boxes are
 * checked — that's the whole point of this field type, as opposed to 'select', where the
 * chosen option's price replaces the product's price).
 *
 * Each option can optionally carry its own stock limit (option.quantity), same as 'select'
 * options already do. Used by every place that inserts registration products — free
 * self/guest registration (registrations.js) and paid checkout (payments.js, at both the
 * pre-payment field check and the actual registration-creation step) — so the rule and its
 * stock accounting can't drift out of sync between those paths.
 */

/**
 * @param {object} dbClient - pg client or pool
 * @param {object} field - the field definition (field.type === 'checkbox')
 * @param {*} selectedValues - whatever the client submitted for this field
 * @param {number} productId - the event_products row this field belongs to
 * @throws {Error} if the selection is invalid, with a message safe to show the user
 */
async function validateCheckboxSelection(dbClient, field, selectedValues, productId) {
  const values = Array.isArray(selectedValues) ? selectedValues : [];
  const min = field.minSelect ?? (field.required ? 1 : 0);
  const max = field.maxSelect ?? Infinity;

  if (values.length < min) {
    throw new Error(
      min === 1
        ? `Choose at least 1 option for "${field.label}"`
        : `Choose at least ${min} options for "${field.label}"`
    );
  }
  if (values.length > max) {
    throw new Error(`Choose at most ${max} option${max === 1 ? '' : 's'} for "${field.label}"`);
  }

  const options = field.options || [];
  const validValues = new Set(options.map(o => (typeof o === 'string' ? o : o.value)));
  for (const v of values) {
    if (!validValues.has(v)) {
      throw new Error(`"${v}" is not a valid option for "${field.label}"`);
    }
  }

  // Enforce per-option stock limits, if any are set on the chosen options.
  for (const opt of options) {
    if (typeof opt !== 'object' || opt.quantity === null || opt.quantity === undefined) continue;
    if (!values.includes(opt.value)) continue;

    const used = await dbClient.query(
      `SELECT COUNT(*)::integer as count
       FROM registration_products rp
       WHERE rp.product_id = $1
         AND rp.deleted_at IS NULL
         AND rp.field_values -> $2 ? $3`,
      [productId, field.id, opt.value]
    );
    const remaining = opt.quantity - used.rows[0].count;
    if (remaining < 1) {
      throw new Error(`"${opt.value}" is no longer available for "${field.label}"`);
    }
  }
}

module.exports = { validateCheckboxSelection };
