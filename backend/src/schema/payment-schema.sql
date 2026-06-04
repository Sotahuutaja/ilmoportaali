-- Payment-related tables for Stripe integration
-- Run this after the main schema is initialized

-- Table to track payment intents (Stripe PaymentIntent objects)
CREATE TABLE IF NOT EXISTS payment_intents (
  id SERIAL PRIMARY KEY,
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  registration_id INTEGER,
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'eur',
  status VARCHAR(50) NOT NULL DEFAULT 'requires_payment_method',
  -- Status can be: requires_payment_method, processing, requires_action, succeeded, canceled, failed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
);

-- Create index on stripe_payment_intent_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_payment_intents_stripe_id
  ON payment_intents(stripe_payment_intent_id);

-- Create index on registration_id for finding payments by registration
CREATE INDEX IF NOT EXISTS idx_payment_intents_registration
  ON payment_intents(registration_id);

-- Create index on status for finding pending/failed payments
CREATE INDEX IF NOT EXISTS idx_payment_intents_status
  ON payment_intents(status);

-- Table to track invoices (created after successful payment)
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  invoice_number VARCHAR(255) UNIQUE NOT NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
);

-- Create index on invoice_number for fast lookup
CREATE INDEX IF NOT EXISTS idx_invoices_number
  ON invoices(invoice_number);

-- Create index on registration_id for finding invoices by registration
CREATE INDEX IF NOT EXISTS idx_invoices_registration
  ON invoices(registration_id);

-- Create index on paid_at for finding paid invoices
CREATE INDEX IF NOT EXISTS idx_invoices_paid
  ON invoices(paid_at);

-- ALTER TABLE to add payment_status to registrations if it doesn't exist
-- (to track overall registration payment status)
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';
  -- Status can be: pending, processing, paid, failed, refunded

-- Create index on payment_status for filtering registrations
CREATE INDEX IF NOT EXISTS idx_registrations_payment_status
  ON registrations(payment_status);
