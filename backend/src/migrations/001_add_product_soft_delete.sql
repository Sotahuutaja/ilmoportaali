-- Migration: Add soft delete support to event_products
-- This migration adds a deleted_at column to allow soft deletes while preserving order history

ALTER TABLE event_products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
