#!/usr/bin/env bash
# Run from any directory. Unit tests have no ambient permissions or credentials.
set -euo pipefail
cd "$(dirname "$0")/../../supabase/functions"
deno task verify
