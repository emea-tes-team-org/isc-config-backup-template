## Context

The operations dashboard (`README.md` via `generate-readme.mjs`) shows tenant **State** using `formatTenantState()` in `generate-dashboard.mjs`. That function treats any active tenant with a non-null last backup date and positive object count as **Healthy**. It never consults the per-tenant attempt status already produced by backup workflows.

Scheduled backup matrix jobs write `backup-results/<tenant>.json` with `status: failed | backed-up | unchanged`. The summary job merges these into `reports/backup-summary-<date>.md`, then regenerates README without passing attempt status. Operators therefore see Healthy tenants after failed runs (e.g. ksb Aug 14 `FAILED_EXTERNAL_COMMUNICATION`).

Constraints: reuse existing report/result data; no new persisted JSON schema; GitHub UI first; dashboard tests via `test-generate-dashboard.mjs` / `test-generate-readme.mjs`; inactive tenants unchanged.

## Goals / Non-Goals

**Goals:**

- Show `⚠️ Backup failed` in the Tenant Overview **State** column when the latest backup attempt for that tenant is `failed`
- Keep `✅ Healthy` for successful attempts (`backed-up`, `unchanged`)
- Wire attempt status from matrix JSON in CI and from latest summary report for local/manual README regeneration
- Add spec scenarios and automated tests

**Non-Goals:**

- Changing backup retry logic or ISC export error handling
- Inferring failure from stale **Last** dates alone
- Adding a new dashboard column
- Backfilling historical reports

## Decisions

### D1: Attempt status drives failure state, not Last date

- **Choice:** Unhealthy state when latest attempt status is `failed`; do not mark failed based on tag age vs calendar
- **Reason:** Avoids false positives before retry window completes; matches user expectation from failed matrix row
- **Considered alternatives:** Stale Last heuristic (rejected — ambiguous); always Healthy if objects exist (current — rejected)

### D2: Status map passed into `generateDashboard()`

- **Choice:** Add optional `attemptStatuses: Record<string, string>` (or Map) to `generateDashboard()` / `renderTenantRow()` / `formatTenantState()`
- **Reason:** Keeps git lookups injectable for tests; minimal API surface
- **Considered alternatives:** Global env reads inside dashboard module (harder to test)

### D3: CI — pass matrix JSON from summary job

- **Choice:** After downloading `backup-results/*.json`, summary job sets env (e.g. `BACKUP_RESULTS`) or passes `--results` when invoking `generate-readme.mjs`
- **Reason:** Same-run data is authoritative; report file may not be committed yet when README is generated
- **Considered alternatives:** Parse report markdown just written (works but duplicates parsing logic)

### D4: Local/manual — load from latest committed report

- **Choice:** Extend `generate-readme.mjs` to load statuses from latest `reports/backup-summary-*.md` when no `--results` / env provided (reuse `findLatestReport()`)
- **Reason:** Operators regenerating README locally see failure state without matrix artifacts
- **Considered alternatives:** Require manual `--results` only (worse DX)

### D5: Shared parser in `generate-report.mjs`

- **Choice:** Export helpers: `normalizeResults()` (existing), plus `loadAttemptStatusesFromResults(json)` and `parseAttemptStatusesFromReport(markdown)` 
- **Reason:** Single place for status vocabulary; report table parsing colocated with report generator
- **Considered alternatives:** Inline regex in readme script (duplication)

### D6: State label `⚠️ Backup failed`

- **Choice:** Use warning emoji prefix consistent with `⚠️ No backups` and `⚠️ Empty backup`
- **Reason:** Visual family of non-healthy-but-not-inactive states
- **Considered alternatives:** `❌` (reserved for inactive tenants)

### D7: Fallback when tenant absent from status map

- **Choice:** If no attempt status available for tenant, preserve current git-only logic
- **Reason:** Tenants not in today's matrix (or manual regen without report) should not be falsely marked failed

## Risks / Trade-offs

- [Risk] Report markdown parsing breaks if table format changes → Mitigation: parse via shared generator tests; add round-trip test report → statuses
- [Risk] Summary job passes empty results → Mitigation: fall back to report file written in prior step or git-only logic
- [Trade-off] State reflects latest **report day** attempt, not live in-flight job → Accepted: matches committed operator view

## Migration Plan

1. Merge script + workflow changes to `main` — next scheduled run produces updated README State
2. No data migration; existing reports remain valid input for local regen
3. Rollback: revert dashboard/readme changes and workflow env pass-through

## Open Questions

_(none)_
