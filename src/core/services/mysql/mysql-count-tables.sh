set -o pipefail
mariadb -N -B -u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT" --ssl-verify-server-cert=0 -e "select count(*) from information_schema.tables where table_schema = database()" "$DB_NAME"
