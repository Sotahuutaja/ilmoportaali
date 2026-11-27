-- Stashes the intended registration payload (products, team, guests, field values,
-- comments) server-side at the moment a Stripe payment intent is created for it — BEFORE
-- any registrations/registration_products row exists for it.
--
-- This exists to close a specific gap: redirect-based payment methods (MobilePay, iDEAL)
-- settle with Stripe independently of our backend, entirely outside our control. If the
-- customer's browser never makes it back to call /confirm-payment (closed tab, lost
-- network, the banking app opening the return URL in a different browser context), the
-- payment succeeds on Stripe's side but nothing is ever registered here, and today there
-- is no way to recover it.
--
-- The periodic sweep in services/checkoutRecovery.js uses this table to finish the
-- registration from the stashed payload when that happens, instead of create-payment-
-- intent's normal response. Nothing else in the app reads this table, so it has zero
-- effect on stock, capacity, dashboards, or any other existing registration-counting
-- query — a registrations/registration_products row is still only ever created at the
-- same moment it is today (browser-driven confirm-payment, or now also the sweep).
CREATE TABLE IF NOT EXISTS pending_checkouts (
  stripe_payment_intent_id VARCHAR(255) PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  registrations JSONB NOT NULL,
  expected_amount_cents INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_checkouts_created_at ON pending_checkouts(created_at);
