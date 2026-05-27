const pool = require('./db');
pool.query(`
  SELECT column_name, is_nullable 
  FROM information_schema.columns 
  WHERE table_name = 'users' 
  AND column_name = 'name'
`).then(r => {
  console.log(r.rows);
  pool.end();
}).catch(err => {
  console.error(err);
  pool.end();
});