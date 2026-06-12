set -o pipefail
gunzip -c "$BACKUP_FILE" | mariadb -u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME"
