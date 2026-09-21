// Shared pricing logic for products with priced field options.
// Mirrors backend/src/utils/pricing.js's resolvePrice() — keep the two in sync if this
// rule ever changes. See that file's comment for the full rationale.
//
// A product has a base price, which can be overridden by two kinds of custom fields:
//
// - 'select' (dropdown) — if the registrant chose an option that carries its own `price`,
//   that single price REPLACES the product's base price.
// - 'checkbox' (checkbox list) — if ANY option in the field carries a `price`, the field is
//   "priced": the product has no base price of its own for it, and the SUM of the checked
//   options' prices (checked options with no price contribute €0) REPLACES the price
//   outright — including replacing it with €0 if nothing priced ends up checked. A checkbox
//   field with no priced options at all keeps the original behavior of never affecting
//   price.
//
// If a product somehow has both a priced select field and a priced checkbox field, the
// checkbox sum wins (evaluated after, and replacing, the select override).

/**
 * @param {number|string} basePrice - the product's base price
 * @param {Array} fields - the product's field definitions (product.fields)
 * @param {object} fieldValues - the registrant's chosen values, keyed by field.id
 * @returns {number} the effective unit price, in euros
 */
export function resolvePrice(basePrice, fields, fieldValues) {
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
 * True when this product has a "priced" checkbox field (see resolvePrice above) with
 * nothing checked in it yet. resolvePrice() correctly reports €0.00 in that state, but
 * showing that flat €0.00 in a product list — before the registrant has even opened the
 * product to pick options — reads as "this costs nothing" rather than "price depends on
 * what you pick". Callers use this to show a "select options" hint instead, for that case
 * only; once anything in the field is checked (even an option worth €0), this returns
 * false and the real computed price is shown, since it's now an actual, deliberate value
 * rather than an unset one.
 *
 * @param {Array} fields - the product's field definitions (product.fields)
 * @param {object} fieldValues - the registrant's chosen values, keyed by field.id
 * @returns {boolean}
 */
export function hasUnselectedPricedCheckbox(fields, fieldValues) {
  const fieldList = fields || [];
  const values = fieldValues || {};

  return fieldList.some(field => {
    if (field.type !== 'checkbox' || !field.options) return false;

    const isPricedField = field.options.some(opt =>
      typeof opt === 'object' && opt.price !== null && opt.price !== undefined
    );
    if (!isPricedField) return false;

    const selected = Array.isArray(values[field.id]) ? values[field.id] : [];
    return selected.length === 0;
  });
}
