set -e
trap 'systemctl start docker' EXIT
systemctl stop docker.socket || true
systemctl stop docker
set -- /etc/easypanel /var/lib/docker/volumes
[ -d /var/lib/docker/buildkit ] && set -- "$@" /var/lib/docker/buildkit
tar czf "$ARCHIVE" --warning=no-file-changed "$@" 2>/dev/null || { rc=$?; [ "$rc" -le 1 ] || exit "$rc"; }
test -s "$ARCHIVE"
