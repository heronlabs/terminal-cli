set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck source=tests/integration/_lib.sh
. "$SCRIPT_DIR/_lib.sh"

HCLI="node $REPO_ROOT/bin/src/main.js"
SEED_GZ="/tmp/mysql-seed.sql.gz"
DUMP_GZ="/tmp/mysql-dump.sql.gz"
SENTINEL="sentinel-row"

proto_stripped="${DB_URL#*://}"
creds="${proto_stripped%%@*}"
hostpart="${proto_stripped#*@}"
DB_USER="${creds%%:*}"
hostport="${hostpart%%/*}"
DB_HOST="${hostport%%:*}"
DB_PORT="${hostport#*:}"
DB_NAME="${hostpart#*/}"
MYSQL_PWD="${creds#*:}"
export MYSQL_PWD

mariadb_exec() {
  mariadb -u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME" -e "$1"
}

mariadb_scalar() {
  mariadb -u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT" --skip-column-names --batch \
    "$DB_NAME" -e "$1" | tr -d '[:space:]'
}

log "Preparing a gzipped seed for rollup"
gzip -c "$SCRIPT_DIR/fixtures/mysql-seed.sql" >"$SEED_GZ"

log "Rolling up the seed via hcli mysql-rollup --local"
$HCLI mysql-rollup --local -f "$SEED_GZ"

log "Asserting the seed restored 3 rows"
seed_count="$(mariadb_scalar 'SELECT count(*) FROM users;')"
assert_eq "seeded row count" "$seed_count" "3"

log "Mutating: inserting 2 more rows incl. the sentinel (probe for data survival)"
mariadb_exec \
  "INSERT INTO users (name, email) VALUES ('$SENTINEL', 'sentinel@example.com'), ('Margaret Hamilton', 'margaret@example.com');"
mutated_count="$(mariadb_scalar 'SELECT count(*) FROM users;')"
assert_eq "mutated row count" "$mutated_count" "5"

log "Backing up via hcli mysql-backup --local"
$HCLI mysql-backup --local -f "$DUMP_GZ"

log "Asserting the backup file exists and is a non-empty gzip"
if [ ! -s "$DUMP_GZ" ]; then
  fail "backup file $DUMP_GZ is missing or empty"
fi
gzip -t "$DUMP_GZ" || fail "backup file $DUMP_GZ is not a valid gzip"
echo "ok: backup file is a non-empty valid gzip"

log "Wiping the database (guards against a no-op restore)"
mariadb -u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT" \
  -e "DROP DATABASE \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\`;"
table_count="$(mariadb_scalar \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = '$DB_NAME' AND table_name = 'users';")"
assert_eq "users table gone after wipe" "$table_count" "0"

log "Restoring the backup via hcli mysql-rollup --local"
$HCLI mysql-rollup --local -f "$DUMP_GZ"

log "Verifying the restore: 5 rows and the sentinel survived"
restored_count="$(mariadb_scalar 'SELECT count(*) FROM users;')"
assert_eq "restored row count" "$restored_count" "5"

sentinel_present="$(mariadb_scalar "SELECT count(*) FROM users WHERE name = '$SENTINEL';")"
assert_eq "sentinel row present after restore" "$sentinel_present" "1"

log "MySQL round-trip passed"
