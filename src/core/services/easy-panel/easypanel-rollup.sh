set -e
test -s "$ARCHIVE"
gzip -t "$ARCHIVE"
trap 'systemctl start docker' EXIT
systemctl stop docker.socket || true
systemctl stop docker
tar xzf "$ARCHIVE" -C /
