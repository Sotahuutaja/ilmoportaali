/**
 * Payment Schema Initialization
 * Automatically creates payment tables on backend startup
 * Runs only if tables don't already exist (idempotent)
 */

const pool = require('./db');

/**
 * Initialize payment schema
 * Creates payment_intents and invoices tables if they don't exist
 */
async function initPaymentSchema() {
  try {
    // Check if payment_intents table already exists
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'payment_intents'
      );
    `);

    if (result.rows[0].exists) {
      console.log('[INIT] Payment schema already initialized');
      return;
    }

    console.log('[INIT] Initializing payment schema...');

    // Create payment_intents table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_intents (
        id SERIAL PRIMARY KEY,
        stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
        registration_id INTEGER,
        amount_cents INTEGER NOT NULL,
        currency VARCHAR(3) DEFAULT 'eur',
        status VARCHAR(50) NOT NULL DEFAULT 'requires_payment_method',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
      );
    `);

    // Create invoices table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        registration_id INTEGER NOT NULL,
        amount_cents INTEGER NOT NULL,
        invoice_number VARCHAR(255) UNIQUE NOT NULL,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        paid_at TIMESTAMP,
        FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
      );
    `);

    // Add payment_status column to registrations if it doesn't exist
    await pool.query(`
      ALTER TABLE registrations
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_intents_stripe_id
      ON payment_intents(stripe_payment_intent_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_intents_registration
      ON payment_intents(registration_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_intents_status
      ON payment_intents(status);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_number
      ON invoices(invoice_number);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_registration
      ON invoices(registration_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_paid
      ON invoices(paid_at);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_registrations_payment_status
      ON registrations(payment_status);
    `);

    console.log('[INIT] ✓ Payment schema initialized successfully');

  } catch (error) {
    console.error('[INIT] ⚠ Payment schema initialization warning:', error.message);
    // Don't crash the server - this might fail on subsequent runs (tables exist)
    // or in test environments. Log the error but continue.
  }
}

module.exports = { initPaymentSchema };
