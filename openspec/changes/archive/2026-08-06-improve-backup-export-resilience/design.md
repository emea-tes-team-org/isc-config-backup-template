## Context

`scripts/backup.mjs` polls SP-Config export jobs at 10-second intervals for up to 60 attempts. Terminal statuses `FAILED`, `CANCELLED`, and stuck `FAILED_EXTERNAL_COMMUNICATION` abort the backup. Tenant `axa` hit 60/60 attempts on 2026-08-06 with no recovery.

Workflow job timeout is 15 minutes (`scheduled-backup.yml`, `backup.yml`). Poll budget is ~10 minutes, leaving little margin for retries or large exports.

## Goals / Non-Goals

**Goals:**
- Retry export on transient ISC communication failures
- Optional per-tenant poll and job timeout in `tenants.yaml`
- Matrix passes timeout to GitHub Actions job

**Non-Goals:**
- Partial export / resume
- ISC platform SLA fixes
- Changing default fleet timeout without explicit opt-in per tenant

## Decisions

### D1: Retryable export statuses
- **Choice:** On `FAILED_EXTERNAL_COMMUNICATION`, abandon job and create new export (up to 2 retries, 3 total attempts)
- **Reason:** Same job ID may be poisoned; fresh export often succeeds
- **Considered alternatives:** Continue polling same job (observed 60 failures); exponential backoff only (doesn't help terminal status)

### D2: Per-tenant configuration
- **Choice:** Optional fields in `tenants.yaml`:
  - `exportPollMinutes` (default 10) → `MAX_POLL_ATTEMPTS = minutes * 6`
  - `jobTimeoutMinutes` (default 15) → workflow `timeout-minutes`
- **Reason:** `axa` can set `{ exportPollMinutes: 20, jobTimeoutMinutes: 25 }` without fleet change

### D3: Propagation to workflows
- **Choice:** `parse-tenants.mjs` includes `jobTimeoutMinutes` in matrix JSON; scheduled-backup uses `timeout-minutes: ${{ matrix.jobTimeoutMinutes || 15 }}`
- **Reason:** Single source in registry; manual backup reads from tenant entry when dispatching

### D4: Logging
- **Choice:** Log export attempt number, job ID, and retry reason to Actions log and backup summary
- **Reason:** Operators diagnosing axa need visibility

## Risks / Trade-offs

- [Risk] Longer axa jobs consume more Actions minutes → Mitigation: opt-in override only
- [Risk] Retry storm on persistent ISC outage → Mitigation: cap at 3 export creations; fail with actionable error
- [Trade-off] Increased complexity in backup.mjs → Acceptable for fleet reliability

## Migration Plan

1. Add optional fields to registry schema and parser
2. Implement retry loop in `backup.mjs`
3. Set `axa` overrides after validation
4. Update specs and tests; deploy to `main`
