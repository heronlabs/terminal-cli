set -o pipefail
psql -tA -c "select count(*) from information_schema.tables where table_schema not in ('pg_catalog', 'information_schema')"
