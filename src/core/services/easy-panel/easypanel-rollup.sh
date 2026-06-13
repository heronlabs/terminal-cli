set -e
trap 'systemctl start docker' EXIT
systemctl stop docker.socket || true
systemctl stop docker
test -s "$ARCHIVE"
tar xzf "$ARCHIVE" -C /
