## Why

Some tenants (notably `axa`) consistently fail backup with ISC export status `FAILED_EXTERNAL_COMMUNICATION` after exhausting 60 poll attempts (~10 minutes). The failure is transient on ISC's side but hard-fails the job today, leaving no backup for that window. Large or busy tenants may need longer poll budgets without slowing the entire fleet. Operators need configurable resilience rather than repeated manual re-runs.

## What Changes

**Transient export failure retry**
- From: single export job; terminal non-COMPLETE status fails immediately
- To: on retryable statuses (`FAILED_EXTERNAL_COMMUNICATION`), create a new export job up to `maxExportRetries` (default 2) before failing
- Reason: ISC export jobs occasionally fail externally and succeed on retry
- Impact: non-breaking; adds latency on failure path only

**Per-tenant poll and job timeout overrides**
- From: fixed 60×10s poll budget and 15-minute workflow job timeout for all tenants
- To: optional `exportPollMinutes` and `jobTimeoutMinutes` in `tenants.yaml`; matrix and backup workflows honor overrides
- Reason: large tenants like `axa` may need >10 minutes without changing fleet defaults
- Impact: non-breaking; defaults unchanged

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `backup`: export polling retry policy and configurable poll duration
- `scheduled-backup`: matrix job timeout derived from tenant registry when override present
- `tenant-registry`: optional backup timeout fields documented and parsed

## Impact

- **Modified files:** `scripts/backup.mjs`, `scripts/parse-tenants.mjs`, `scripts/tenant-registry.mjs`, `.github/workflows/scheduled-backup.yml`, `.github/workflows/backup.yml`, tests, `tenants.yaml` examples
- **Operators:** can tune `axa` (and others) without code changes
- **GitHub Actions:** axa-sized tenants may run longer when override set; fleet default unchanged
