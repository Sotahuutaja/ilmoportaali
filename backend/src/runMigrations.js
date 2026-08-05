/**
 * Database Migration Runner
 * Automatically runs pending SQL migrations on server startup
 */

const pool = require('./db');
const fs = require('fs');
const path = require('path');

/**
 * Initialize migrations tracking table
 */
async function initMigrationsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version TEXT UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error('[MIGRATIONS] Failed to create migrations table:', err.message);
    throw err;
  }
}

/**
 * Get list of executed migrations
 */
async function getExecutedMigrations() {
  try {
    const result = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
    return result.rows.map(row => row.version);
  } catch (err) {
    console.error('[MIGRATIONS] Failed to fetch executed migrations:', err.message);
    throw err;
  }
}

/**
 * Get list of pending migration files
 */
function getPendingMigrations(executed) {
  const migrationsDir = path.join(__dirname, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  return files.filter(file => !executed.includes(file));
}

/**
 * Run a single migration
 */
async function runMigration(filename) {
  const filepath = path.join(__dirname, 'migrations', filename);

  try {
    const sql = fs.readFileSync(filepath, 'utf8');

    // Run migration in a transaction
    await pool.query('BEGIN');

    // Execute the migration SQL
    await pool.query(sql);

    // Record the migration
    await pool.query(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      [filename]
    );

    await pool.query('COMMIT');

    console.log(`[MIGRATIONS] ✓ ${filename}`);
    return true;
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {}); // Ignore rollback errors
    console.error(`[MIGRATIONS] ✗ ${filename}: ${err.message}`);
    throw err;
  }
}

/**
 * Run all pending migrations
 */
async function runMigrations() {
  try {
    console.log('[MIGRATIONS] Starting migration runner...');

    // Initialize migrations table
    await initMigrationsTable();

    // Get executed migrations
    const executed = await getExecutedMigrations();

    // Get pending migrations
    const pending = getPendingMigrations(executed);

    if (pending.length === 0) {
      console.log('[MIGRATIONS] Database is up to date');
      return;
    }

    console.log(`[MIGRATIONS] Running ${pending.length} pending migration(s)...`);

    // Run each pending migration
    for (const migration of pending) {
      await runMigration(migration);
    }

    console.log('[MIGRATIONS] All migrations completed successfully');
  } catch (err) {
    console.error('[MIGRATIONS] Migration runner failed:', err.message);
    throw err;
  }
}

module.exports = { runMigrations };
