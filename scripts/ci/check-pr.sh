#!/usr/bin/env bash
# Validates PR title, source branch name and target branch.
# Inputs come from env vars (never interpolated into the script) so a
# malicious PR title cannot inject shell.
#   PR_TITLE, HEAD_REF, BASE_REF
set -u
fail=0
types='feat|fix|chore|docs|refactor|test|ci|build|perf|revert'

if [[ "$HEAD_REF" == dependabot/* ]]; then
  echo "Dependabot PR, skipping convention checks."; exit 0
fi

if ! [[ "$PR_TITLE" =~ ^($types)(\([a-z0-9-]+\))?!?:\ .+ ]]; then
  echo "::error::PR title must be a Conventional Commit, e.g. 'feat(schema): add catches ledger'. Got: $PR_TITLE"
  fail=1
fi

case "$BASE_REF" in
  main)
    if [[ "$HEAD_REF" != "Develop" && "$HEAD_REF" != hotfix/* ]]; then
      echo "::error::Only 'Develop' or 'hotfix/*' may open a PR into main. Retarget this PR to Develop."
      fail=1
    fi ;;
  Develop)
    if [[ "$HEAD_REF" == "main" ]]; then
      echo "Back-merge main -> Develop, allowed."
    elif ! [[ "$HEAD_REF" =~ ^($types|research|hotfix)/[a-z0-9][a-z0-9._-]*$ ]]; then
      echo "::error::Branch '$HEAD_REF' must look like 'feat/short-description' (lowercase, prefix one of: $types, research, hotfix)."
      fail=1
    fi ;;
  *)
    echo "PR into '$BASE_REF' (not main or Develop), no target rule applies." ;;
esac
exit $fail
