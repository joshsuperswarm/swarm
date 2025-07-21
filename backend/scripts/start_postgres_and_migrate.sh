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
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$HOME")"
MIGRATIONS_DIR="$REPO_ROOT/backend/migrations"

# Initialise cluster on first run
if [[ ! -s "$PGDATA/PG_VERSION" ]]; then
  initdb -D "$PGDATA" -U "$PGUSER"
fi

# Start postgres in the background (daemonised by pg_ctl)
pg_ctl -D "$PGDATA" -o "-p $PGPORT -k /tmp" -l "$PGDATA/postgres.log" start
until pg_isready -q -h /tmp -p "$PGPORT"; do sleep 0.5; done

# Create target database
createdb -h /tmp -p "$PGPORT" -U "$PGUSER" "$DBNAME"

export DATABASE_URL="postgres://$PGUSER@localhost:$PGPORT/$DBNAME"
sqlx migrate run --source "$MIGRATIONS_DIR"

echo "✅ Postgres started on $PGPORT and migrations applied."