set -o pipefail
mariadb-dump --no-tablespaces -u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT" --ssl-verify-server-cert=0 "$DB_NAME" | gzip > "$BACKUP_FILE"
