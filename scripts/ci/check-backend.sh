#!/usr/bin/env bash
# Run from any directory. Unit tests have no ambient permissions or credentials.
set -euo pipefail
# Resolve before changing directory, so relative executable paths work too.
deno_bin="${DENO_BIN:-deno}"
if ! resolved_deno="$(command -v "$deno_bin")"; then
  echo 'Deno is unavailable. Install Deno 2.9.6 on PATH or set DENO_BIN to its executable.' >&2
  exit 127
fi
if [[ "$resolved_deno" != /* ]]; then
  resolved_deno="$PWD/$resolved_deno"
fi
cd "$(dirname "$0")/../../supabase/functions"
"$resolved_deno" task verify
