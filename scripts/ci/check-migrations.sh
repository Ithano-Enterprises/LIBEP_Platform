#!/usr/bin/env bash
# 1. Migration filenames follow the Supabase CLI pattern.
# 2. Migrations already on the base branch are immutable: a PR may only ADD
#    files under supabase/migrations. Editing history would make the hosted
#    database and the repo disagree, because `db push` never re-runs a version.
#   BASE_REF = target branch name (e.g. Develop)
set -u
fail=0
dir=supabase/migrations

shopt -s nullglob
for f in "$dir"/*; do
  name=$(basename "$f")
  [[ "$name" == ".gitkeep" ]] && continue
  if ! [[ "$name" =~ ^[0-9]{14}_[a-z0-9_]+\.sql$ ]]; then
    echo "::error file=$f::Migration name must be YYYYMMDDHHMMSS_snake_case.sql (use 'supabase migration new <name>')."
    fail=1
  fi
done

while IFS=$'\t' read -r status path _; do
  [[ -z "${status:-}" ]] && continue
  [[ "$path" == "$dir/.gitkeep" ]] && continue
  if [[ "$status" != "A" ]]; then
    echo "::error file=$path::Existing migration was changed (git status '$status'). Merged migrations are immutable; add a new migration instead."
    fail=1
  fi
done < <(git diff --name-status "origin/${BASE_REF}...HEAD" -- "$dir")
exit $fail
