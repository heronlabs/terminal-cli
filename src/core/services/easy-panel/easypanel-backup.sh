set -e
trap 'systemctl start docker' EXIT
systemctl stop docker.socket || true
systemctl stop docker
tar czf "$ARCHIVE" --warning=no-file-changed /etc/easypanel /var/lib/docker/volumes /var/lib/docker/buildkit 2>/dev/null || { rc=$?; [ "$rc" -le 1 ] || exit "$rc"; }
test -s "$ARCHIVE"
