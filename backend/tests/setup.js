/**
 * Jest setup - runs before all tests
 */

const pool = require('../src/db');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mywebsite_test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.APP_URL = 'http://localhost:3000';

jest.setTimeout(10000);

// Create necessary tables for tests
beforeAll(async () => {
  try {
    // Create email_queue table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_queue (
        id SERIAL PRIMARY KEY,
        registration_id INTEGER,
        email_type VARCHAR(100) NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        subject TEXT,
        body TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        attempt_count INTEGER DEFAULT 0,
        last_error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('Failed to create test tables:', err.message);
  }
});

afterEach(() => {
  jest.clearAllMocks();
});
