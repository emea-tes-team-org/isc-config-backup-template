# Plan 002: Re-enable schedule gate in backup matrix

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for plan 002
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ceb6041..HEAD -- .github/workflows/scheduled-backup.yml scripts/parse-tenants.mjs`
> Compare excerpts on mismatch — STOP if unexpected drift.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/001-fix-backup-tag-timestamp-detection.md
- **Category**: perf
- **Planned at**: commit `ceb6041`, 2026-08-03

## Why this matters

The per-tenant schedule feature (`--check-schedule` in `parse-tenants.mjs`) was
implemented and documented in
`openspec/changes/archive/2026-06-18-per-tenant-backup-schedules/tasks.md`
(task 2.2) but the workflow regressed: `scheduled-backup.yml` only passes
`--check-pending`, not `--check-schedule`. Failed tenants (e.g. `axa`) are retried
every 15 minutes around the clock instead of only during their schedule window,
burning ~10 minutes per retry × up to 96 runs/day.

## Current state

Workflow parse step (schedule path):

```51:56:.github/workflows/scheduled-backup.yml
          else
            # Filter by pending status for all triggers
            ALL_ACTIVE=$(node scripts/parse-tenants.mjs --active-only)
            SCHEDULE_MATCH=$ALL_ACTIVE
            MATRIX=$(node scripts/parse-tenants.mjs --active-only --check-pending)
            COUNT=$(echo "$MATRIX" | jq '.include | length')
```

Spec expectation (`openspec/specs/per-tenant-schedule/spec.md`): tenants are
included only when schedule matches current UTC **and** backup is pending.

`SCHEDULE_MATCH` is incorrectly set to all active tenants instead of
schedule-filtered tenants — summary reports show wrong skip reasons.

Parser already supports combined flags — verified:
`node scripts/parse-tenants.mjs --active-only --check-pending --check-schedule`
returns 0 tenants outside schedule windows.

Manual dispatch with `inputs.tenant` must continue bypassing all filters (unchanged).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Workflow refs | `node scripts/test-workflow-references.mjs` | exit 0 |
| Schedule filter | `node scripts/parse-tenants.mjs --active-only --check-schedule --count` | 0 outside matching cron windows |
| Combined filter | `node scripts/parse-tenants.mjs --active-only --check-schedule --check-pending --count` | ≤ schedule-only count |

## Scope

**In scope**:
- `.github/workflows/scheduled-backup.yml` (prepare-matrix step only)

**Out of scope**:
- Cron expression changes (plan 003)
- `scripts/parse-tenants.mjs` logic (plan 001 unless drift requires touch-up)

## Git workflow

- Branch: `advisor/002-schedule-gate`
- Commit: `ci: apply --check-schedule filter in scheduled backup matrix`
- Do NOT push unless instructed.

## Steps

### Step 1: Fix prepare-matrix parse logic

For the `else` branch (non manual-tenant dispatch):

```bash
ALL_ACTIVE=$(node scripts/parse-tenants.mjs --active-only)
SCHEDULE_MATCH=$(node scripts/parse-tenants.mjs --active-only --check-schedule)

if [ "${{ github.event_name }}" = "schedule" ]; then
  MATRIX=$(node scripts/parse-tenants.mjs --active-only --check-schedule --check-pending)
else
  # workflow_dispatch without tenant: respect pending but allow any-time retry
  MATRIX=$(node scripts/parse-tenants.mjs --active-only --check-pending)
fi
COUNT=$(echo "$MATRIX" | jq '.include | length')
```

Keep manual `inputs.tenant` branch unchanged.

**Verify**: `node scripts/test-workflow-references.mjs` → exit 0

### Step 2: Validate summary inputs still correct

Ensure `schedule_match` output now reflects schedule-filtered tenants so
`generate-report.mjs` can report `skipped` vs `pending` accurately.

**Verify**: Read `scripts/generate-report.mjs` — confirm it consumes
`scheduleMatchJson`; no script change needed if output shape unchanged.

### Step 3: Document behavior in workflow comment

Add a 2-line comment above the parse block explaining:
- `schedule` events: schedule match + pending required
- `workflow_dispatch`: pending only (operator-initiated catch-up)

## Test plan

- `node scripts/test-workflow-references.mjs`
- `node scripts/test-generate-report.mjs` (report still renders skipped rows)
- Manual YAML review: confirm `if: ${{ needs.prepare-matrix.outputs.count != '0' }}`
  still skips backup job when matrix empty

## Done criteria

- [ ] Scheduled cron path uses `--check-schedule --check-pending`
- [ ] `SCHEDULE_MATCH` uses `--check-schedule` output
- [ ] Manual tenant dispatch still bypasses filters
- [ ] `workflow_dispatch` without tenant uses `--check-pending` only
- [ ] `node scripts/test-workflow-references.mjs` exits 0
- [ ] `plans/README.md` row 002 → DONE

## STOP conditions

- Plan 001 not merged/applied and pending detection still wrong for squashed tags.
- Combined flags produce unexpected empty matrix at known schedule times — report
  with `parse-tenants` output samples.
- `generate-report.mjs` requires new matrix fields — stop and scope a script change.

## Maintenance notes

- When adding tenants with non-midnight schedules, `--check-schedule` ensures they
  only run in their window; cron frequency (plan 003) must cover those windows.
- Reviewers: confirm schedule event vs workflow_dispatch paths stay distinct.
