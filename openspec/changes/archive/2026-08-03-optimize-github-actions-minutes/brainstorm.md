# Brainstorm: Optimize GitHub Actions Minutes

Raw capture from design exploration session (2026-08-03), informed by `/improve` audit and live workflow run analysis.

## Background

The centralized scheduler (`scheduled-backup.yml`) fires every 15 minutes (`*/15 * * * *`) — 96 times per day. Recent production runs consume **~11 minutes each** when stale or failed tenants appear in the matrix. At that rate, scheduled workflows alone can exceed **30,000 minutes/month**.

Six active tenants in `tenants.yaml`, all scheduled `"0 0 * * *"`. The parser (`parse-tenants.mjs`) supports `--check-schedule` and `--check-pending`, but the workflow only passes `--check-pending`. Per-tenant schedule filtering was implemented in archive change `2026-06-18-per-tenant-backup-schedules` (task 2.2) but regressed in the live workflow.

Backup tags use format `<tenant>/YYYY-MM-DD_HH-MM-SS`. Pending detection sorts tags by `--sort=-creatordate`. After branch squash/offboard, many tags share identical creatordate while name-embedded timestamps differ — causing false "pending" (verified: `mediolanum` retried every 15 min despite successful backups today).

Failed tenant `axa` (no tag since July 26) retries every 15 min all day (~10 min/run ≈ 960 min/day). A separate `dashboard.yml` triggers via `workflow_run` after every scheduled completion (~20s extra).

## Decision Chain

### Q1: What is the primary minute burn?

**Decision:** Three compounding causes, in order of impact:
1. **False pending** from tag creatordate bug → redundant backup jobs
2. **Missing schedule gate** → off-window retries for failed tenants
3. **96×/day cron polling** → idle prepare-matrix + summary jobs

**Rejected:** Blaming parallel matrix fan-out alone — midnight burst is ~6×1 min; the 15-min polling dominates.

### Q2: Fix tag detection or change tag format?

**Decision:** **Parse timestamp from tag name**, not git creatordate. Tag format is stable across workflows and documented in specs. Pick max embedded timestamp per tenant prefix.

**Rejected:** Migrating to annotated tags with correct creatordate — doesn't fix historical tags; higher migration cost.

### Q3: Re-enable `--check-schedule` in workflow?

**Decision:** **Yes.** Schedule events use `--check-schedule --check-pending`. Manual `workflow_dispatch` without tenant input uses `--check-pending` only (operator catch-up). Manual dispatch with tenant input bypasses all filters (unchanged).

**Rejected:** Pending-only forever — spec and archive tasks explicitly require schedule gate on cron triggers.

### Q4: How narrow the cron?

**Decision:** Replace `*/15 * * * *` with explicit entries covering the union of tenant schedule windows plus a **1-hour retry band**:
- `0 0 * * *` (primary)
- `15,30,45 0 * * *` (retries)
- `0,15,30,45 1 * * *` (extended retry)

For current fleet (all midnight UTC): **8 runs/day** vs 96 (~91% reduction). Document how to add cron lines when onboarding tenants with new schedules. GitHub limit: 5 cron entries per workflow — current fleet fits.

**Rejected:**
- Hourly `0 * * * *` — misses minute-level cron expressions
- Keep `*/15` with better filtering — still 96 prepare-matrix invocations/day

### Q5: What about idle summary and dashboard jobs?

**Decision:**
- Skip `summary` job when matrix count is 0
- Inline dashboard generation into summary job when backups run
- Remove `workflow_run` trigger from `dashboard.yml` (keep manual dispatch)
- Add `concurrency: cancel-in-progress` on scheduled-backup

**Rejected:** Delete summary reports entirely — operators need visibility when backups run.

### Q6: npm cache and backup timeout?

**Decision:** Add `cache: 'npm'` to setup-node before `npm ci` in backup workflows. Set `timeout-minutes: 15` on backup jobs (successful runs complete in ~30–60s; failed API hangs currently ~10 min).

**Out of scope:** restore/tokenize workflows (lower frequency).

### Q7: Stagger tenant schedules?

**Decision:** **Optional follow-up**, not in this change. All tenants at `0 0 * * *` causes midnight burst but is not the primary minute burn. Document as ops recommendation in README.

### Q8: Per-branch cron (ADR-0001)?

**Decision:** **Rejected** for this change. Conflicts with centralized scheduler architecture; large propagation cost for marginal additional savings on top of plans above.

## Design Trade-offs

| Trade-off | Acceptance |
|-----------|------------|
| Failed midnight backup only retries within 1-hour band | Acceptable — operator can manual-dispatch after; stops all-day burn |
| More cron entries to maintain when schedules diversify | Document in workflow comment; fits within GitHub 5-cron limit for foreseeable fleet |
| Dashboard no longer auto-runs on every schedule tick | Manual dispatch preserved; artifact uploaded from summary job |
| 15-min backup timeout may truncate legitimately slow exports | Monitor; increase only with evidence |

## Capability Fit (existing openspec/specs/)

- **MODIFY** `backup-pending-check` — tag name timestamp, not creatordate
- **MODIFY** `scheduled-backup` — cron frequency, schedule gate, idle skip, concurrency, cache, timeout
- **MODIFY** `per-tenant-schedule` — workflow must apply schedule filter on cron events
- **MODIFY** `schedule-aware-parser` — latest-tag selection by embedded timestamp
- **MODIFY** `dashboard-generation` — triggered from summary job, not workflow_run

## Validated Scope for Proposal

**In scope:**
- `scripts/parse-tenants.mjs` + `scripts/test-parse-tenants.mjs`
- `.github/workflows/scheduled-backup.yml`
- `.github/workflows/dashboard.yml`
- `.github/workflows/backup.yml`, `drift-detection.yml` (cache + timeout)
- README schedule/cron documentation
- Delta specs + tests

**Out of scope:**
- Per-branch cron migration (ADR-0001 pattern)
- Self-hosted runners
- Fixing `axa` tenant credentials (ops, not CI)
- Staggering tenant schedules in `tenants.yaml`
