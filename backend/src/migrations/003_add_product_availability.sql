-- Migration: Add product-specific availability windows
-- Allows each product to have independent sales times separate from event registration times

ALTER TABLE event_products ADD COLUMN IF NOT EXISTS available_from TIMESTAMP;
ALTER TABLE event_products ADD COLUMN IF NOT EXISTS available_until TIMESTAMP;
