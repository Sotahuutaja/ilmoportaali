const pool = require('./db');

/**
 * Initialize logs table on server startup
 */
async function initLogs() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id        SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        category  TEXT NOT NULL,
        level     TEXT NOT NULL,
        message   TEXT NOT NULL,
        details   JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_admin_logs_timestamp ON admin_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_category ON admin_logs(category);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_level ON admin_logs(level);
    `);

    console.log('[LOGS] Admin logs table initialized');
  } catch (err) {
    console.error('[LOGS] Failed to initialize logs table:', err.message);
    throw err;
  }
}

module.exports = { initLogs };
