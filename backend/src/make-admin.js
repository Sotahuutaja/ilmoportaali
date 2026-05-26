const pool = require('./db');

pool.query('UPDATE users SET role = $1 WHERE email = $2', ['admin', 'vhalminen@gmail.com'])
  .then(() => {
    console.log('Done');
    pool.end();
  })
  .catch(err => {
    console.error(err);
    pool.end();
  });