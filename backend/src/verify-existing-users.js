const pool = require('./db');

async function run() {
  const result = await pool.query('UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE');
  console.log(`Marked ${result.rowCount} existing users as verified`);
  await pool.end();
}

run().catch(err => { console.error(err); process.exit(1); });