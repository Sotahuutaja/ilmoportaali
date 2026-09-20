// Frontend mirror of backend/src/utils/volunteerPricing.js's applyVolunteerDiscount — kept
// in sync with it the same way resolvePrice() is mirrored between the two utils/pricing.js
// files. Used so the price shown while picking products (and at checkout) already reflects
// an approved volunteer's discount, matching what the backend will actually charge — the
// backend remains the source of truth and re-verifies everything independently, but
// without this the customer only finds out about their discount after paying.
//
// `candidates` is the list of discount rules that apply to a given product (from
// GET /events/:eventId/volunteers/my-discounts), never looked up for a guest — guests have
// no independent account and are never eligible for volunteer benefits.
export function applyVolunteerDiscount(listedPrice, candidates) {
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
