#!/usr/bin/env bash
# Read-only prerequisite check. Never starts/resets a database or prints keys.
set -u
missing=0
for tool in deno supabase docker; do
  if command -v "$tool" >/dev/null 2>&1; then
    "$tool" --version || missing=1
  else
    echo "Missing: $tool"
    missing=1
  fi
done
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    echo 'Docker daemon is available.'
  else
    echo 'Docker daemon is unavailable. Start Docker before local database tests.'
    missing=1
  fi
fi
exit "$missing"
