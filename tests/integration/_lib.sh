log() {
  echo ""
  echo "==> $1"
}

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

assert_eq() {
  local label="$1"
  local actual="$2"
  local expected="$3"

  if [ "$actual" != "$expected" ]; then
    fail "$label: expected '$expected', got '$actual'"
  fi

  echo "ok: $label == '$expected'"
}
