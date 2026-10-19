# Plan 003: Narrow cron to backup windows

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for plan 003
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ceb6041..HEAD -- .github/workflows/scheduled-backup.yml tenants.yaml`
> STOP on unexpected drift.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-re-enable-schedule-gate-in-matrix.md
- **Category**: perf
- **Planned at**: commit `ceb6041`, 2026-08-03

## Why this matters

The workflow cron `*/15 * * * *` fires **96 times per day**. Even when the
matrix is empty, each run starts `prepare-matrix` and `summary` jobs (~1–2
minutes combined). That is ~96–192 minutes/day of idle orchestration alone.
With plan 002's schedule gate active, backups only matter during tenant cron
windows — so the poll frequency can drop dramatically.

Current registry (`tenants.yaml`): all 6 active tenants use `"0 0 * * *"`.
They need coverage at minute 0 plus retry slots shortly after — not every 15
minutes all day.

## Current state

```4:6:.github/workflows/scheduled-backup.yml
  schedule:
    # Check every 15 minutes for tenants whose schedule matches
    - cron: '*/15 * * * *'
```

GitHub Actions does not support dynamic cron. Static cron entries must cover
the union of all tenant schedule windows plus a retry band.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| List schedules | `node -e "import('./scripts/tenant-registry.mjs').then(m=>console.log(m.loadRegistry().tenants.filter(t=>t.active).map(t=>t.schedule||'0 0 * * *')))"` | list of cron strings |
| Workflow refs | `node scripts/test-workflow-references.mjs` | exit 0 |

## Scope

**In scope**:
- `.github/workflows/scheduled-backup.yml` — `on.schedule` cron entries + comment
- `README.md` — update "runs every 15 minutes" wording if present (one paragraph only)

**Out of scope**:
- Changing individual tenant schedules in `tenants.yaml` (optional follow-up)
- Parser or report logic

## Git workflow

- Branch: `advisor/003-narrow-cron`
- Commit: `ci: reduce scheduled backup polling to schedule windows`
- Do NOT push unless instructed.

## Steps

### Step 1: Compute minimum cron coverage

Run locally and record distinct active schedules:

```bash
node --input-type=module -e "
import { loadRegistry } from './scripts/tenant-registry.mjs';
const schedules = [...new Set(
  loadRegistry().tenants.filter(t => t.active).map(t => t.schedule || '0 0 * * *')
)];
console.log(schedules.join('\n'));
"
```

For each distinct schedule, determine the minute and hour fields. For the
current fleet (all `0 0 * * *`), the union needs:
- Primary: `0 0 * * *` (daily midnight UTC)
- Retries: `15,30,45 0 * * *` and optionally `0,15,30,45 1 * * *` for failed
  backups within a 1-hour retry band

If other schedules exist (e.g. `0 6 * * 1`), add cron lines covering those
minute/hour combinations only — do NOT revert to `*/15 * * * *`.

**Target for current fleet: 8 runs/day** (4 in hour 0 + 4 in hour 1) instead of 96.

### Step 2: Replace single wildcard cron with explicit entries

In `.github/workflows/scheduled-backup.yml`:

```yaml
on:
  schedule:
    # Primary backup window (matches tenants scheduled at 00:00 UTC)
    - cron: '0 0 * * *'
    # Retry slots within 1 hour of primary window
    - cron: '15,30,45 0 * * *'
    - cron: '0,15,30,45 1 * * *'
    # ADD lines here for any non-midnight schedules found in step 1
  workflow_dispatch:
    # unchanged
```

Update the comment to document how to add cron lines when onboarding tenants
with new schedules.

**Verify**: `node scripts/test-workflow-references.mjs` → exit 0

### Step 3: Update README schedule description

Find the paragraph mentioning 15-minute checks or 00:00 UTC default in
`README.md` and align it with the new cron strategy (8 checks/day for the
current all-midnight fleet; manual dispatch unchanged).

**Verify**: `grep -n '15 min' README.md` → no stale claims (or updated text)

### Step 4: Estimate minute savings

Document in PR/commit body (not a new doc file): 96 → 8 scheduled triggers/day
≈ **91% reduction** in idle orchestration runs.

## Test plan

- YAML lint: ensure multiple cron entries are valid (GitHub accepts up to 5 per workflow — **STOP if more than 5 distinct windows needed**; see STOP conditions).
- Manual dispatch still works (unaffected by cron).
- At minute 0 UTC with pending tenants, matrix count > 0 (plan 001+002 applied).

## Done criteria

- [ ] Cron no longer uses `*/15 * * * *`
- [ ] All active tenant schedules have at least one matching cron entry
- [ ] Retry band covers ≥1 hour after each primary schedule
- [ ] `node scripts/test-workflow-references.mjs` exits 0
- [ ] README schedule wording accurate
- [ ] `plans/README.md` row 003 → DONE

## STOP conditions

- Step 1 finds **more than 5 distinct schedule windows** — GitHub limits 5 cron
  entries per workflow. STOP and report; solution requires schedule consolidation
  or a coordinator pattern instead of continuing.
- Any active tenant schedule uses sub-hourly minute patterns not covered by the
  retry band — list uncovered tenants and stop.
- Plan 002 not applied — do not narrow cron without schedule gate.

## Maintenance notes

- **Onboarding**: when adding a tenant with a new schedule, add a matching cron
  line (document in workflow comment). Consider a future plan to auto-generate
  cron from `tenants.yaml` via a validation script.
- Staggering tenants across hours (e.g. `0 1 * * *`, `0 2 * * *`) further reduces
  parallel matrix fan-out at midnight — optional ops improvement, not required here.
