set -o pipefail
mariadb-dump -u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME" | gzip > "$BACKUP_FILE"
