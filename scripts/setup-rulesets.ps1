# Creates or updates the two branch rulesets (Develop and main).
# Run from the repo root, logged in to gh as a repo admin. Safe to re-run:
# an existing ruleset with the same name is updated, not duplicated.
#
#   .\scripts\setup-rulesets.ps1                 # 0 approvals (solo phase)
#   .\scripts\setup-rulesets.ps1 -Approvals 1    # once a second person has access
#
# Rulesets are only enforced because the repo is public. On a private repo on
# the Free plan GitHub accepts them but does not enforce them.
param([int]$Approvals = 0)

# Read from the clone's remote, so the script survives a repo rename.
$repo = gh repo view --json nameWithOwner --jq '.nameWithOwner'
if (-not $repo) { throw 'Could not detect the repo. Run this from inside the clone, logged in to gh.' }

# The one check required to pass. It must be a check that runs on EVERY pull
# request. Database and Apps checks only run when their folders change, so
# requiring them would leave unrelated PRs waiting forever.
$requiredCheck = 'Title, branch name, target branch'

# Develop takes squash merges (one commit per PR). main takes merge commits
# (so Develop and main keep a shared history and release PRs stay clean).
$branches = @(
  @{ Name = 'Protect Develop'; Ref = 'refs/heads/Develop'; Merge = 'squash' },
  @{ Name = 'Protect main';    Ref = 'refs/heads/main';    Merge = 'merge'  }
)

$existing = gh api "repos/$repo/rulesets" | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Could not list rulesets. Is gh logged in as a repo admin?' }

foreach ($b in $branches) {
  $body = @{
    name        = $b.Name
    target      = 'branch'
    enforcement = 'active'
    conditions  = @{ ref_name = @{ include = @($b.Ref); exclude = @() } }
    rules       = @(
      @{ type = 'deletion' },            # branch cannot be deleted
      @{ type = 'non_fast_forward' },    # no force pushes
      @{ type = 'pull_request'; parameters = @{
          required_approving_review_count   = $Approvals
          dismiss_stale_reviews_on_push     = $true
          require_code_owner_review         = $false
          require_last_push_approval        = $false
          required_review_thread_resolution = $false
          allowed_merge_methods             = @($b.Merge)
        } },
      @{ type = 'required_status_checks'; parameters = @{
          strict_required_status_checks_policy = $false
          required_status_checks               = @(@{ context = $requiredCheck })
        } }
    )
  } | ConvertTo-Json -Depth 10

  # Written to a file because PowerShell mangles quotes in JSON passed as an
  # argument to a native program.
  $tmp = New-TemporaryFile
  [IO.File]::WriteAllText($tmp.FullName, $body)

  $match = $existing | Where-Object { $_.name -eq $b.Name }
  if ($match) {
    gh api --method PUT "repos/$repo/rulesets/$($match.id)" --input $tmp.FullName | Out-Null
    $verb = 'Updated'
  } else {
    gh api --method POST "repos/$repo/rulesets" --input $tmp.FullName | Out-Null
    $verb = 'Created'
  }
  $code = $LASTEXITCODE
  Remove-Item $tmp.FullName
  if ($code -ne 0) { throw "Failed on ruleset '$($b.Name)'. Nothing after it was changed." }
  Write-Host "$verb ruleset: $($b.Name) (approvals: $Approvals, merge method: $($b.Merge))"
}
Write-Host 'Done.'
