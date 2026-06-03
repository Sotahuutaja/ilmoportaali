const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 30,                        // Max concurrent connections (increased from default 10 for better concurrency)
  idleTimeoutMillis: 30000,       // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000,  // Fail fast if can't acquire connection within 2 seconds
});

module.exports = pool;