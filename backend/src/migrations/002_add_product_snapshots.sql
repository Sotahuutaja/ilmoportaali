-- Migration: Add product snapshot tracking for audit history
-- Stores product name and price at time of purchase/modification
-- Allows admins to see what was actually purchased vs. current product details

ALTER TABLE registration_products ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE registration_products ADD COLUMN IF NOT EXISTS product_price DECIMAL(10, 2);
ALTER TABLE registration_products ADD COLUMN IF NOT EXISTS snapshot_at TIMESTAMP DEFAULT NOW();
ALTER TABLE registration_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE registration_products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE registration_products ADD COLUMN IF NOT EXISTS modification_reason VARCHAR(50);
