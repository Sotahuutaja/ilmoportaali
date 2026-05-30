// Usage: node src/make-admin.js <email>
// Example: node src/make-admin.js alice@example.com

const pool = require('./db');

const email = process.argv[2];

if (!email) {
  console.error('Error: email argument is required.');
  console.error('Usage: node src/make-admin.js <email>');
  process.exit(1);
}

pool.query('UPDATE users SET role = $1 WHERE email = $2', ['admin', email])
  .then(result => {
    if (result.rowCount === 0) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }
    console.log(`Done — ${email} is now an admin.`);
    pool.end();
  })
  .catch(err => {
    console.error(err);
    pool.end();
  });
