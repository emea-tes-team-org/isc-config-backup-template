## Context

The ISC Config Hub uses a centralized matrix scheduler on `main` (`scheduled-backup.yml`) that reads `tenants.yaml`, determines pending tenants, and dispatches parallel backup jobs. Per-tenant cron schedules and pending detection were implemented in 2026-06 archive changes, but production usage reveals three efficiency gaps:

1. **Tag timestamp bug** — `parse-tenants.mjs` selects latest backup tags by git creatordate; tags recreated during branch squash share creatordate while name-embedded timestamps differ, causing false pending.
2. **Schedule gate regression** — workflow omits `--check-schedule` on cron triggers; failed tenants retry every 15 minutes all day.
3. **Over-polling** — `*/15 * * * *` fires 96 times/day; most runs spin prepare-matrix + summary for an empty matrix.

Recent runs (`gh run list`) show ~11 minutes per trigger when stale/failed tenants are included. Six active tenants, all `"0 0 * * *"`.

Constraints: GitHub Actions allows max 5 cron entries per workflow; centralized scheduler (not ADR-0001 per-branch cron); operator visibility via summary reports and dashboard must be preserved.

## Goals / Non-Goals

**Goals:**
- Reduce scheduled workflow triggers from 96/day to ~8/day for the current fleet
- Stop false-pending and off-window retry minute burn
- Preserve manual `workflow_dispatch` (single-tenant and catch-up) behavior
- Maintain backup summary reports and dashboard when backups actually run

**Non-Goals:**
- Migrate to per-branch cron (ADR-0001)
- Self-hosted runners
- Stagger tenant schedules in registry (ops recommendation only)
- Fix individual tenant credential failures (e.g. `axa`)

## Decisions

### D1: Tag timestamp source

- **Choice:** Parse UTC timestamp from tag name (`/<tenant>/YYYY-MM-DD_HH-MM-SS$`); per tenant, keep tag with greatest parsed timestamp.
- **Reason:** Tag name is the operator-visible backup time and survives creatordate resets from squash/force-push.
- **Considered alternatives:** Git creatordate (current — broken after squash); annotated tag messages (requires migration).

### D2: Schedule gate on cron events

- **Choice:** `schedule` event → `--check-schedule --check-pending`; `workflow_dispatch` without tenant → `--check-pending`; `workflow_dispatch` with tenant → bypass (unchanged).
- **Reason:** Matches `per-tenant-schedule` spec and archive task 2.2; stops all-day retry for failed tenants.
- **Considered alternatives:** Pending-only (current regression); schedule-only without pending (duplicate backups within window).

### D3: Cron entry strategy

- **Choice:** Static cron entries for union of schedule windows + 1-hour retry band. Current fleet: `0 0 * * *`, `15,30,45 0 * * *`, `0,15,30,45 1 * * *`.
- **Reason:** 8 runs/day vs 96; fits GitHub 5-cron limit; covers midnight schedule + retries.
- **Considered alternatives:** Keep `*/15` with filters (still 96 job starts); hourly poll (misses minute-specific crons).

### D4: Idle job handling

- **Choice:** Skip summary when count=0; inline dashboard in summary; remove dashboard `workflow_run` trigger; add concurrency cancel-in-progress.
- **Reason:** No-op runs should not consume 2+ minutes of runner time or spawn a third workflow.
- **Considered alternatives:** Delete summary entirely (rejected — operator visibility); keep separate dashboard workflow_run (redundant cost).

### D5: Per-job efficiency

- **Choice:** `cache: 'npm'` on setup-node; `timeout-minutes: 15` on backup jobs in scheduled-backup, backup, drift-detection.
- **Reason:** Successful backups finish in under 1 minute; cache saves install time across matrix; timeout caps failed API hang (~10 min observed).
- **Considered alternatives:** Composite action for shared setup (over-engineering for 2 deps).

## Risks / Trade-offs

- [Risk] New tenant schedule not covered by cron entries → tenant never auto-backs up → **Mitigation:** Document cron addition in workflow comment; validate schedules on onboarding; manual dispatch always available.
- [Risk] 15-min timeout truncates large tenant export → **Mitigation:** Monitor first week; increase only with evidence.
- [Risk] GitHub 5-cron limit exceeded as schedules diversify → **Mitigation:** STOP and revisit coordinator pattern if >5 distinct windows needed.
- [Trade-off] Failed backup only auto-retries within 1-hour band → **Accepted:** manual dispatch for later catch-up; stops 960 min/day burn per failing tenant.

## Migration Plan

1. Deploy parser fix first (001) — immediately stops false pending for squashed-tag tenants.
2. Re-enable schedule gate (002) — stops off-window retries.
3. Narrow cron (003) — reduces trigger count; deploy during low-traffic period (any time safe since gate prevents duplicate backups).
4. Skip idle jobs + dashboard merge (004).
5. npm cache + timeout (005) — independent, can ship anytime.

**Rollback:** Revert workflow YAML and parser commits; no data migration. Widen cron back to `*/15` if retry band too narrow (unlikely).

**Acceptance:** After 24h, scheduled run count ≤10/day; no healthy tenant in matrix outside midnight window; total Actions minutes drop >80% vs prior week.

## Open Questions

- Should onboarding workflow auto-add a cron line when tenant schedule doesn't match existing entries? (Deferred — document manual step for v1.)
- Should `axa` be offboarded or fixed separately? (Ops — out of scope.)
