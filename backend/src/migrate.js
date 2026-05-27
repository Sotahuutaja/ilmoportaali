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

    CREATE TABLE IF NOT EXISTS teams (
      id          SERIAL PRIMARY KEY,
      name        TEXT UNIQUE NOT NULL,
      description TEXT,
      created_by  INTEGER REFERENCES users(id),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id         SERIAL PRIMARY KEY,
      team_id    INTEGER REFERENCES teams(id) ON DELETE CASCADE,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role       TEXT NOT NULL DEFAULT 'member',
      status     TEXT NOT NULL DEFAULT 'pending',
      invited_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(team_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS event_products (
      id          SERIAL PRIMARY KEY,
      event_id    INTEGER REFERENCES events(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT,
      price       NUMERIC(10,2) NOT NULL DEFAULT 0,
      quantity    INTEGER,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS registration_products (
      id              SERIAL PRIMARY KEY,
      registration_id INTEGER REFERENCES registrations(id) ON DELETE CASCADE,
      product_id      INTEGER REFERENCES event_products(id) ON DELETE CASCADE,
      quantity        INTEGER NOT NULL DEFAULT 1,
      UNIQUE(registration_id, product_id)
    );

    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id);
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS guest_name TEXT;
	ALTER TABLE registrations ADD COLUMN IF NOT EXISTS guest_first_name TEXT;
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS guest_last_name TEXT;
    ALTER TABLE registrations ADD COLUMN IF NOT EXISTS guest_email TEXT;
	ALTER TABLE users ADD COLUMN IF NOT EXISTS year_of_birth INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
	ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
	ALTER TABLE users ALTER COLUMN name DROP NOT NULL;
	ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_expires TIMESTAMPTZ;
  `);

  console.log('Migration complete');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});