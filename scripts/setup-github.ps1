# One-time GitHub configuration. Run from the repo root after the first push.
# Requires the GitHub CLI, logged in as an org admin:  gh auth login
# Safe to re-run.
$ErrorActionPreference = 'Stop'
# Read from the clone's remote, so the script survives a repo rename.
$repo = gh repo view --json nameWithOwner --jq '.nameWithOwner'
if (-not $repo) { throw 'Could not detect the repo. Run this from inside the clone, logged in to gh.' }

# Develop is the default so new PRs target it without anyone thinking.
# Squash keeps Develop's history one-line-per-PR; merge commits stay enabled
# for Develop -> main releases. Rebase merge is off to keep one way of doing it.
gh repo edit $repo --default-branch Develop --delete-branch-on-merge `
  --enable-squash-merge --enable-merge-commit --enable-rebase-merge=false

$labels = @(
  @('area/backend',        '1d76db', 'Schema, Edge Functions, Supabase config'),
  @('area/logbook-app',    '1d76db', 'Fisher phone app'),
  @('area/plant-dashboard','1d76db', 'Plant receiving website'),
  @('area/infra-ci',       '1d76db', 'Workflows, hooks, scripts, infra'),
  @('area/docs',           '1d76db', 'Documentation'),
  @('stage/1-vessel', '0e8a16', 'Vessel management and deployment'),
  @('stage/2-fishing','0e8a16', 'Fishing operations, the logbook'),
  @('stage/3-port',   '0e8a16', 'Return to port'),
  @('stage/4-plant',  '0e8a16', 'Processing plant operations'),
  @('stage/5-dispatch','0e8a16','Packaging and dispatch'),
  @('stage/6-market', '0e8a16', 'Market and customer feedback'),
  @('stage/platform', '0e8a16', 'Dashboard, alerts, analytics'),
  @('task',           'c5def5', 'Unit of roadmap work'),
  @('bug',            'd73a4a', 'Behaves differently from intended'),
  @('to-confirm',     'fbca04', 'Blocked on an unverified fact'),
  @('process',        'b60205', 'Source control rule was bypassed')
)
foreach ($l in $labels) {
  gh label create $l[0] --repo $repo --color $l[1] --description $l[2] --force
}

$milestones = @(
  'M0 Repo foundations',
  'M1 Fisher logbook',
  'M2 Vessel and fisher registry',
  'M3 Return to port',
  'M4a Plant receiving (minimal)',
  'M4 Processing plant (full)',
  'M5 Packaging and dispatch',
  'M6 Market and customer feedback'
)
$existing = gh api "repos/$repo/milestones?state=all" --jq '.[].title'
foreach ($m in $milestones) {
  if ($existing -notcontains $m) {
    gh api "repos/$repo/milestones" -f title="$m" | Out-Null
    Write-Host "Created milestone: $m"
  }
}
Write-Host 'Done.'
