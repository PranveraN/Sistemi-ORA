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

echo "[entrypoint] Schema is in sync."

# Skriptet e mbjelljes/migrimit — të gjitha idempotente (kontrollojnë çka
# ekziston para se të krijojnë/ndryshojnë, ndaj janë të sigurta të
# riekzekutohen në çdo nisje). Ekzekutohen automatikisht këtu sepse s'ka
# qasje SSH në server për t'i nisur manualisht pas çdo deploy — kështu
# katalogu/migrimet mbeten gjithmonë të përditësuara pa asnjë hap shtesë.
# Një dështim këtu (p.sh. skript i ri me gabim) NUK e ndalon nisjen e
# app-it — vetëm loget si paralajmërim.
for script in \
    scripts/seed-material-categories.ts \
    scripts/seed-material-catalog-full.ts \
    scripts/migrate-material-requests.ts \
    scripts/migrate-invoice-items-student.ts \
; do
    if [ -f "$script" ]; then
        echo "[entrypoint] Duke ekzekutuar $script..."
        npx tsx "$script" || echo "[entrypoint] KUJDES: $script dështoi — nisja e app-it vazhdon"
    fi
done

echo "[entrypoint] Starting: $*"
exec "$@"
