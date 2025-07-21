#!/usr/bin/env bash
# Boot a single-user Postgres inside a Modal sandbox
# and apply the Rust SQLx migrations.
set -euo pipefail

# Add PostgreSQL binaries to PATH
export PATH="/usr/lib/postgresql/15/bin:$PATH"

PGDATA="${PGDATA:-$HOME/.postgres}"
PGUSER="${PGUSER:-swarm}"
PGPORT="${PGPORT:-5432}"
DBNAME="${DBNAME:-swarm}"
REPO_ROOT="/home/swarm/swarm"
MIGRATIONS_DIR="$REPO_ROOT/backend/migrations"

# Initialise cluster on first run
if [[ ! -s "$PGDATA/PG_VERSION" ]]; then
  echo "Initializing PostgreSQL cluster..."
  initdb -D "$PGDATA" -U "$PGUSER"
  echo "✓ PostgreSQL cluster initialized"
fi

# Start postgres in the background (daemonised by pg_ctl)
echo "Starting PostgreSQL server..."
pg_ctl -D "$PGDATA" -o "-p $PGPORT -k /tmp" -l "$PGDATA/postgres.log" start
echo "✓ PostgreSQL server started"

echo "Waiting for PostgreSQL to be ready..."
until pg_isready -q -h /tmp -p "$PGPORT"; do sleep 0.5; done
echo "✓ PostgreSQL is ready"

# Create target database
echo "Creating database '$DBNAME'..."
createdb -h /tmp -p "$PGPORT" -U "$PGUSER" "$DBNAME"
echo "✓ Database '$DBNAME' created"

echo "Running migrations..."
echo "REPO_ROOT: $REPO_ROOT"
echo "MIGRATIONS_DIR: $MIGRATIONS_DIR"
echo "Checking if migrations directory exists..."
if [[ -d "$MIGRATIONS_DIR" ]]; then
  echo "✓ Migrations directory found"
  ls -la "$MIGRATIONS_DIR"
else
  echo "✗ Migrations directory not found at: $MIGRATIONS_DIR"
  echo "Available directories in backend:"
  ls -la "$REPO_ROOT/backend/" 2>/dev/null || echo "backend directory not found"
fi

export DATABASE_URL="postgres://$PGUSER@localhost:$PGPORT/$DBNAME"
sqlx migrate run --source "$MIGRATIONS_DIR"
echo "✓ Migrations completed"

echo "✅ Postgres started on $PGPORT and migrations applied."