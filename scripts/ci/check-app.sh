#!/usr/bin/env bash
# Runs install + lint + typecheck + test for one app folder.
# Deliberately stack-agnostic: it only assumes npm and three script names,
# so it works for the Expo app and whatever the plant dashboard is built in.
#   usage: check-app.sh apps/<name>
set -eu
app="$1"
if [ ! -f "$app/package.json" ]; then
  echo "No package.json in $app yet, nothing to check."; exit 0
fi
if [ ! -f "$app/package-lock.json" ]; then
  echo "::error::$app has a package.json but no package-lock.json. Commit the lockfile so CI installs exactly what you tested."
  exit 1
fi
cd "$app"
npm ci
npm run lint --if-present
npm run typecheck --if-present
npm run test --if-present
