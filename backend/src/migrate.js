const pool = require('./db');

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id        SERIAL PRIMARY KEY,
      email     TEXT UNIQUE NOT NULL,
      password  TEXT NOT NULL,
      name      TEXT NOT NULL,
      role      TEXT NOT NULL DEFAULT 'attendee',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS events (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT,
      location    TEXT,
      starts_at   TIMESTAMPTZ NOT NULL,
      ends_at     TIMESTAMPTZ NOT NULL,
      capacity    INTEGER,
      creator_id  INTEGER REFERENCES users(id),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id),
      event_id   INTEGER REFERENCES events(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, event_id)
    );
  `);

  console.log('Migration complete');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});