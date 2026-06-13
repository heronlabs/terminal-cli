# Shared helpers for the backup/rollup round-trip integration scripts.
# Sourced (not executed) by psql-roundtrip.sh / mysql-roundtrip.sh, so it carries
# no shebang and no `set` flags — the caller owns `set -euo pipefail`.

# log "msg" — print a section marker that stands out in CI logs.
log() {
  echo ""
  echo "==> $1"
}

# fail "msg" — print an error and abort the script with a non-zero status.
fail() {
  echo "FAIL: $1" >&2
  exit 1
}

# assert_eq "label" "$actual" "$expected" — scalar equality check; fail on mismatch.
assert_eq() {
  local label="$1"
  local actual="$2"
  local expected="$3"

  if [ "$actual" != "$expected" ]; then
    fail "$label: expected '$expected', got '$actual'"
  fi

  echo "ok: $label == '$expected'"
}
