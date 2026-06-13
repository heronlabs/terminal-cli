set -o pipefail
gunzip -c "$BACKUP_FILE" | psql
