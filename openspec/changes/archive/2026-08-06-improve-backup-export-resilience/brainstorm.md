# Brainstorm: Improve Backup Export Resilience

Raw capture from design exploration (2026-08-06).

## Background

Tenant `axa` fails repeatedly at the **Run backup** step with ISC export status `FAILED_EXTERNAL_COMMUNICATION` for all 60 poll attempts (~10 minutes). Job timeout is 15 minutes. Other tenants complete in under 2 minutes. Same failure pattern across multiple scheduled and manual runs since at least 2026-08-03.

Current `backup.mjs` treats any non-COMPLETE terminal status as hard failure. `MAX_POLL_ATTEMPTS=60` × `POLL_INTERVAL_MS=10_000` = 10 min poll budget, plus API call time, fits within 15-min job timeout with no headroom for recovery.

This may be ISC-side instability for large tenants, but the platform should degrade gracefully and allow operator tuning.

## Decision Chain

### Q1: Retry transient export failures?

**Decision:** Treat `FAILED_EXTERNAL_COMMUNICATION` (and optionally `PENDING` stuck states) as **retryable**: restart export job up to N times before failing.

**Rejected:** Infinite poll on same job ID — job may be poisoned; create fresh export.

### Q2: Configurable timeouts?

**Decision:** Add optional `exportPollMinutes` (or `backupTimeoutMinutes`) per tenant in `tenants.yaml`; default remains 10 minutes poll / 15 minute job timeout.

**Reason:** `axa` may need longer poll window without changing fleet default.

### Q3: Per-tenant job timeout in workflow?

**Decision:** Increase scheduled/matrix job timeout when tenant override exceeds default, or set matrix `timeout-minutes` to 20 fleet-wide as minimal bump.

**Prefer:** Per-tenant override in registry → matrix passes `timeout-minutes` from parser output.

### Q4: Partial export on timeout?

**Decision:** **Out of scope** — SP-Config export is all-or-nothing; partial state is not usable for restore.

## Validated Scope

**In scope:** Retry export on transient failure statuses; optional per-tenant poll/timeout in `tenants.yaml`; matrix job timeout from registry; tests; backup spec updates.

**Out of scope:** ISC platform fixes; axa credential rotation; tag script path; retry concurrency.
