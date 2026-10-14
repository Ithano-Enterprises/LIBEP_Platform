#!/usr/bin/env bash
# Checks tool availability. Never starts/resets a database or prints keys.
# A tool's own --version command may initialize its local CLI configuration.
set -u
missing=0
check_tool() {
  local name="$1" executable="$2" variable="$3"
  if command -v "$executable" >/dev/null 2>&1; then
    if ! "$executable" --version; then
      echo "Cannot run $name. Check its executable and local configuration permissions."
      missing=1
    fi
  else
    echo "Missing: $name. Install it on PATH or set $variable to its executable."
    missing=1
  fi
}
check_tool deno "${DENO_BIN:-deno}" DENO_BIN
check_tool supabase "${SUPABASE_BIN:-supabase}" SUPABASE_BIN
check_tool docker "${DOCKER_BIN:-docker}" DOCKER_BIN
if command -v "${DOCKER_BIN:-docker}" >/dev/null 2>&1; then
  if "${DOCKER_BIN:-docker}" info >/dev/null 2>&1; then
    echo 'Docker daemon is available.'
  else
    echo 'Docker daemon is unavailable. Start Docker before local database tests.'
    missing=1
  fi
fi
exit "$missing"
