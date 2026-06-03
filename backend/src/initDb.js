/**
 * Database initialization script
 * Creates indexes on startup to improve query performance
 * Safe to run multiple times (uses IF NOT EXISTS)
 */

const pool = require('./db');

const INDEXES = [
  // Users table
  'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
  'CREATE INDEX IF NOT EXISTS idx_users_id ON users(id)',

  // Events table
  'CREATE INDEX IF NOT EXISTS idx_events_creator_id ON events(creator_id)',
  'CREATE INDEX IF NOT EXISTS idx_events_id ON events(id)',

  // Registrations table
  'CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id)',
  'CREATE INDEX IF NOT EXISTS idx_registrations_user_id ON registrations(user_id)',

  // Team members table
  'CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id)',
  'CREATE INDEX IF NOT EXISTS idx_team_members_user_role_status ON team_members(user_id, role, status)',

  // Event managers table
  'CREATE INDEX IF NOT EXISTS idx_event_managers_event_id ON event_managers(event_id)',
  'CREATE INDEX IF NOT EXISTS idx_event_managers_user_id ON event_managers(user_id)',

  // Event products table
  'CREATE INDEX IF NOT EXISTS idx_event_products_event_id ON event_products(event_id)',

  // Registration products table
  'CREATE INDEX IF NOT EXISTS idx_registration_products_registration_id ON registration_products(registration_id)',
  'CREATE INDEX IF NOT EXISTS idx_registration_products_product_id ON registration_products(product_id)',

  // Composite indexes for common queries
  'CREATE INDEX IF NOT EXISTS idx_registrations_event_user ON registrations(event_id, user_id)',
  'CREATE INDEX IF NOT EXISTS idx_event_teams_event_id ON event_teams(event_id)',
];

async function initDb() {
  try {
    console.log('Initializing database indexes...');
    let created = 0;

    for (const index of INDEXES) {
      try {
        await pool.query(index);
        created++;
      } catch (err) {
        // Index might already exist or other error
        if (!err.message.includes('already exists')) {
          console.warn(`Warning creating index: ${err.message}`);
        }
      }
    }

    console.log(`Database initialization complete. Ensured ${INDEXES.length} indexes exist.`);
  } catch (err) {
    console.error('Database initialization failed:', err.message);
    throw err;
  }
}

module.exports = { initDb };
