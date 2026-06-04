#!/usr/bin/env node

/**
 * Database initialization script
 * Reads and executes the payment schema SQL file
 *
 * Usage: node init-database.js
 *
 * Environment variables required:
 * - DB_HOST (or DATABASE_URL)
 * - DB_USER
 * - DB_PASSWORD
 * - DB_NAME
 * - DB_PORT (optional, defaults to 5432)
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Get database connection details from environment variables
const dbConfig = {
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  user: process.env.DB_USER || process.env.PGUSER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
  database: process.env.DB_NAME || process.env.PGDATABASE || 'ilmoportaali',
  port: process.env.DB_PORT || process.env.PGPORT || 5432,
  ssl: process.env.DB_SSL !== 'false' // SSL enabled by default for Azure
};

console.log('🔧 Database Initialization Script');
console.log('━'.repeat(50));
console.log(`Connecting to: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
console.log(`User: ${dbConfig.user}`);
console.log('');

// Create connection pool
const pool = new Pool(dbConfig);

async function initializeDatabase() {
  let client;

  try {
    // Connect to database
    client = await pool.connect();
    console.log('✓ Connected to database');

    // Read SQL schema file
    const schemaPath = path.join(__dirname, 'backend/src/schema/payment-schema.sql');

    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }

    const sqlScript = fs.readFileSync(schemaPath, 'utf-8');
    console.log('✓ Loaded schema file');

    // Execute the SQL script
    console.log('');
    console.log('Executing schema...');
    console.log('━'.repeat(50));

    await client.query(sqlScript);

    console.log('━'.repeat(50));
    console.log('✓ Schema executed successfully');
    console.log('');
    console.log('📊 Database initialized with:');
    console.log('  • payment_intents table');
    console.log('  • invoices table');
    console.log('  • registrations.payment_status column');
    console.log('  • Performance indexes');

  } catch (error) {
    console.error('');
    console.error('❌ Error initializing database:');
    console.error('');
    console.error(error.message);
    console.error('');

    // Helpful error messages
    if (error.message.includes('password')) {
      console.error('💡 Tip: Check your DB_PASSWORD environment variable');
    }
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Tip: Check DB_HOST and DB_PORT are correct');
    }
    if (error.message.includes('no pg_hba.conf')) {
      console.error('💡 Tip: Add your IP to Azure PostgreSQL firewall rules');
    }

    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run initialization
initializeDatabase();
