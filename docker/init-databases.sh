#!/bin/bash
set -e

echo "Initializing PostgreSQL databases..."

# Create test database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE ${POSTGRES_DB}_test;
    GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO "$POSTGRES_USER";
    GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB}_test TO "$POSTGRES_USER";
EOSQL

echo "✓ Database initialization complete: $POSTGRES_DB and ${POSTGRES_DB}_test"
