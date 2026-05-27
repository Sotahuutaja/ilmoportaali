const pool = require('./db');

async function fix() {
  try {
    await pool.query('ALTER TABLE users ALTER COLUMN name DROP NOT NULL');
    console.log('Done — name column is now nullable');
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    await pool.end();
  }
}

fix();