# Plan 004: Skip idle jobs and merge dashboard

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for plan 004
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ceb6041..HEAD -- .github/workflows/scheduled-backup.yml .github/workflows/dashboard.yml scripts/generate-dashboard.mjs`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/003-narrow-cron-to-backup-windows.md
- **Category**: perf
- **Planned at**: commit `ceb6041`, 2026-08-03

## Why this matters

Even after narrowing cron frequency, many scheduled runs will have `count=0`
(no tenants pending in-window). Today:

1. **`summary` job always runs** (`if: always()`) — checkout, generate report,
   attempt commit even when zero backups ran.
2. **`dashboard.yml` triggers on every scheduled completion** via
   `workflow_run` — adds another runner with `fetch-depth: 0` (~20–26 seconds
   × every scheduled run).

Eliminating idle jobs saves ~1–2 minutes per empty run plus dashboard overhead.

## Current state

Summary job condition:

```194:198:.github/workflows/scheduled-backup.yml
  summary:
    name: Backup Summary
    needs: [prepare-matrix, backup]
    if: always()
    runs-on: ubuntu-latest
```

Dashboard trigger:

```3:7:.github/workflows/dashboard.yml
on:
  workflow_dispatch:
  workflow_run:
    workflows: ["Scheduled ISC Backup Matrix"]
    types: [completed]
```

`scripts/generate-dashboard.mjs` is a standalone Node script (no npm deps beyond
Node built-ins) — safe to call from the summary job when backups actually ran.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Dashboard tests | `node scripts/test-generate-dashboard.mjs` | exit 0 |
| Report tests | `node scripts/test-generate-report.mjs` | exit 0 |
| Workflow refs | `node scripts/test-workflow-references.mjs` | exit 0 |

## Scope

**In scope**:
- `.github/workflows/scheduled-backup.yml` — summary job `if` + optional dashboard step
- `.github/workflows/dashboard.yml` — remove or narrow `workflow_run` trigger

**Out of scope**:
- Changing report/dashboard content or format
- `scripts/generate-dashboard.mjs` logic (call as-is)

## Git workflow

- Branch: `advisor/004-skip-idle-jobs`
- Commit: `ci: skip summary and inline dashboard when backup matrix empty`
- Do NOT push unless instructed.

## Steps

### Step 1: Skip summary when matrix count is zero

Change summary job condition:

```yaml
summary:
  needs: [prepare-matrix, backup]
  if: ${{ needs.prepare-matrix.outputs.count != '0' }}
```

Remove `always()` — when count=0, backup job is skipped and no summary needed.

Add a lightweight log step to `prepare-matrix` when count=0:

```yaml
- name: No pending backups
  if: steps.parse.outputs.count == '0'
  run: echo "No tenants pending in this window — skipping backup and summary jobs."
```

**Verify**: Review YAML — backup job already has
`if: ${{ needs.prepare-matrix.outputs.count != '0' }}`.

### Step 2: Inline dashboard generation into summary job

After the existing "Generate summary" step in `summary`, add:

```yaml
- name: Generate dashboard
  run: |
    node scripts/generate-dashboard.mjs > DASHBOARD.md
    cat DASHBOARD.md >> $GITHUB_STEP_SUMMARY

- name: Upload dashboard artifact
  uses: actions/upload-artifact@v4
  with:
    name: backup-dashboard-${{ github.run_id }}
    path: DASHBOARD.md
```

Do NOT commit `DASHBOARD.md` to the repo unless it was previously committed —
check: `git ls-files DASHBOARD.md`. If not tracked, artifact + step summary only.

### Step 3: Remove workflow_run trigger from dashboard.yml

Keep `workflow_dispatch` on `dashboard.yml` for manual regeneration. Remove:

```yaml
  workflow_run:
    workflows: ["Scheduled ISC Backup Matrix"]
    types: [completed]
```

Add a comment pointing operators to the scheduled summary job artifact.

**Verify**: `node scripts/test-workflow-references.mjs` → exit 0

### Step 4: Add concurrency guard (optional but recommended)

At workflow level in `scheduled-backup.yml`:

```yaml
concurrency:
  group: scheduled-backup-${{ github.ref }}
  cancel-in-progress: true
```

Prevents overlapping scheduled runs from stacking when a backup exceeds 15 minutes.

**Verify**: YAML parses; no duplicate `concurrency` keys.

## Test plan

- `node scripts/test-generate-dashboard.mjs`
- `node scripts/test-generate-report.mjs`
- `node scripts/test-workflow-references.mjs`
- Manual review: count=0 path skips both backup and summary

## Done criteria

- [ ] Summary skipped when `count == 0`
- [ ] Dashboard generated inside summary when backups run
- [ ] `dashboard.yml` no longer auto-triggers on every scheduled completion
- [ ] Manual dashboard dispatch still works
- [ ] Concurrency group added to scheduled-backup
- [ ] All three test scripts exit 0
- [ ] `plans/README.md` row 004 → DONE

## STOP conditions

- `DASHBOARD.md` is committed to main and operators expect it updated in-repo —
  stop and propose a commit step instead of artifact-only.
- Inlining dashboard adds >60s to summary job consistently — report metrics.
- `workflow_run` removal breaks documented operator workflow — update README
  in-scope if needed.

## Maintenance notes

- Dashboard artifact name includes `run_id` to avoid collisions.
- If dashboard generation becomes heavy, consider running it only on the
  midnight primary cron (check `github.event.schedule`).
