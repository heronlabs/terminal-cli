set -o pipefail
pg_dump | gzip > "$BACKUP_FILE"
