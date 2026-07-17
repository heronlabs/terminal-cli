set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck source=integration/_lib.sh
. "$SCRIPT_DIR/../_lib.sh"

HCLI="node $REPO_ROOT/bin/src/main.js"
SEED_GZ="/tmp/psql-seed.sql.gz"
DUMP_GZ="/tmp/psql-dump.sql.gz"
SENTINEL="sentinel-row"

proto_stripped="${DB_URL#*://}"
creds="${proto_stripped%@*}"
hostpart="${proto_stripped##*@}"
PGUSER="${creds%%:*}"
PGPASSWORD="${creds#*:}"
hostport="${hostpart%%/*}"
PGHOST="${hostport%%:*}"
PGPORT="${hostport#*:}"
PGDATABASE="${hostpart#*/}"
export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE

psql_scalar() {
  psql --no-align --tuples-only --quiet -c "$1" | tr -d '[:space:]'
}

log "Preparing a gzipped seed for rollup"
gzip -c "$SCRIPT_DIR/seed.sql" >"$SEED_GZ"

log "Rolling up the seed via hcli psql-rollup --local"
$HCLI psql-rollup --local -f "$SEED_GZ"

log "Asserting the seed restored 3 rows"
seed_count="$(psql_scalar 'SELECT count(*) FROM users;')"
assert_eq "seeded row count" "$seed_count" "3"

log "Mutating: inserting 2 more rows incl. the sentinel (probe for data survival)"
psql --quiet -v ON_ERROR_STOP=1 -c \
  "INSERT INTO users (name, email) VALUES ('$SENTINEL', 'sentinel@example.com'), ('Margaret Hamilton', 'margaret@example.com');"
mutated_count="$(psql_scalar 'SELECT count(*) FROM users;')"
assert_eq "mutated row count" "$mutated_count" "5"

log "Backing up via hcli psql-backup --local"
$HCLI psql-backup --local -f "$DUMP_GZ"

log "Asserting the backup file exists and is a non-empty gzip"
if [ ! -s "$DUMP_GZ" ]; then
  fail "backup file $DUMP_GZ is missing or empty"
fi
gzip -t "$DUMP_GZ" || fail "backup file $DUMP_GZ is not a valid gzip"
echo "ok: backup file is a non-empty valid gzip"

log "Wiping the schema (guards against a no-op restore)"
psql --quiet -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
table_present="$(psql_scalar "SELECT to_regclass('public.users') IS NOT NULL;")"
assert_eq "users table gone after wipe" "$table_present" "f"

log "Restoring the backup via hcli psql-rollup --local"
$HCLI psql-rollup --local -f "$DUMP_GZ"

log "Verifying the restore: 5 rows and the sentinel survived"
restored_count="$(psql_scalar 'SELECT count(*) FROM users;')"
assert_eq "restored row count" "$restored_count" "5"

sentinel_present="$(psql_scalar "SELECT count(*) FROM users WHERE name = '$SENTINEL';")"
assert_eq "sentinel row present after restore" "$sentinel_present" "1"

log "PostgreSQL round-trip passed"
