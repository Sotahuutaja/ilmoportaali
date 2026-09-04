-- Migration: Mark products that identify a registrant (e.g. event tickets)
-- At most one identifying product (summed by quantity) may be selected per registration.
-- Only registrations that include an active identifying product count toward event capacity.

ALTER TABLE event_products ADD COLUMN IF NOT EXISTS is_identifying BOOLEAN NOT NULL DEFAULT FALSE;
