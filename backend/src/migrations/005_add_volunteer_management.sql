-- Migration: Add volunteer management
-- Lets event organizers opt an event into recruiting volunteers (security, info desk,
-- build/setup crew, referees, etc.) through the portal. Volunteers apply to one or more
-- roles and must be approved by an organizer before any per-product discount applies.
-- Turning volunteering_enabled off only blocks new applications — it never touches
-- existing roles, applications or discount rules, so already-approved volunteers keep
-- their benefits.

ALTER TABLE events ADD COLUMN IF NOT EXISTS volunteering_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- A role an organizer defines for their event (e.g. "Security", "Info desk").
-- capacity mirrors event_products.quantity: NULL means unlimited.
CREATE TABLE IF NOT EXISTS volunteer_roles (
  id          SERIAL PRIMARY KEY,
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  capacity    INTEGER,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- A user's application to work a given role at a given event. UNIQUE is on
-- (event_id, user_id, role_id) rather than (event_id, user_id) so one person can hold
-- multiple roles at the same event at once (e.g. both "Security" and "Referee").
CREATE TABLE IF NOT EXISTS event_volunteers (
  id            SERIAL PRIMARY KEY,
  event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id       INTEGER NOT NULL REFERENCES volunteer_roles(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending',
  applied_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_by   INTEGER REFERENCES users(id),
  reviewed_at   TIMESTAMP,
  notes         TEXT,
  UNIQUE(event_id, user_id, role_id)
);

-- Per-role, per-product discount/benefit rules. discount_type is one of:
--   'free'           - the product costs nothing (discount_value unused)
--   'percent'        - discount_value is a percentage off (e.g. 50 = 50% off)
--   'fixed_amount'   - discount_value euros are subtracted from the price
--   'override_price' - discount_value replaces the price outright
-- Only APPROVED volunteers benefit from these; guest registrations never qualify.
CREATE TABLE IF NOT EXISTS volunteer_product_discounts (
  id             SERIAL PRIMARY KEY,
  role_id        INTEGER NOT NULL REFERENCES volunteer_roles(id) ON DELETE CASCADE,
  product_id     INTEGER NOT NULL REFERENCES event_products(id) ON DELETE CASCADE,
  discount_type  TEXT NOT NULL,
  discount_value NUMERIC(10,2),
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_volunteer_roles_event ON volunteer_roles(event_id);
CREATE INDEX IF NOT EXISTS idx_event_volunteers_event ON event_volunteers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_volunteers_user ON event_volunteers(user_id);
CREATE INDEX IF NOT EXISTS idx_event_volunteers_role ON event_volunteers(role_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_product_discounts_role ON volunteer_product_discounts(role_id);
