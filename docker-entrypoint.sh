#!/bin/sh
# ---------------------------------------------------------------------------
# Akademia Ora — container entrypoint
#
# The SQLite database lives on a persistent volume (/data). This script makes
# sure the database exists AND its schema matches the app code before starting:
#
#   * If NO database file exists yet  -> it is created with the current schema
#     (an empty database, no demo data).
#   * If a database file ALREADY exists (e.g. your real database) -> its data is
#     preserved and the schema is brought up to date NON-DESTRUCTIVELY: new
#     tables/columns the code added are applied; nothing is ever dropped.
#
# Safety: we run `prisma db push` WITHOUT `--accept-data-loss`. Prisma will
# only make additive changes; if any change would lose data it ABORTS with an
# error (and `set -e` stops the container) instead of touching your records.
# This is what lets you deploy a newer app version on top of the live database.
# ---------------------------------------------------------------------------
set -e

# DATABASE_URL is expected to look like: file:/data/akademia-ora.db
DB_PATH="$(printf '%s' "${DATABASE_URL:-file:/data/akademia-ora.db}" | sed 's/^file://')"

if [ -f "$DB_PATH" ]; then
    echo "[entrypoint] Existing database found at $DB_PATH — preserving data, syncing schema (non-destructive)..."
else
    echo "[entrypoint] No database at $DB_PATH — creating it with the current schema..."
fi

npx prisma db push --skip-generate

echo "[entrypoint] Schema is in sync. Starting: $*"
exec "$@"
