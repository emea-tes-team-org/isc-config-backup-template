## Why

Operators reading the backup dashboard (`DASHBOARD.md`) or the per-run summary report (`reports/backup-summary-*.md`) cannot identify which ISC environment a tenant row refers to — the tenant name `company12926-poc` is opaque without its SailPoint hostname (e.g. `company12926-poc.identitynow-demo.com`), and the schedule column shows *when the cron currently matches* but not *when the next backup will fire*. The result is two tables that are technically complete but practically unhelpful at a glance.

This change adds a `hostname` reference field to `tenants.yaml`, populates a description on every entry, computes the next backup time from each tenant's cron expression, and surfaces all three in both tables. Hostname is treated as a *reference*, not a source of truth — the authoritative URL continues to live in `.tenant.yaml` on each tenant branch.

## What Changes

- **tenants.yaml**: every tenant entry gains an optional `hostname:` reference and a `description:` label.
- **scripts/cron-utils.mjs (NEW)**: extracts the cron matching/next-time/previous-time helpers from `parse-tenants.mjs` so both `parse-tenants.mjs` and the dashboard generator can share them.
- **scripts/parse-tenants.mjs**: imports cron utilities from `cron-utils.mjs`; includes `hostname` in the CI matrix output.
- **scripts/generate-dashboard.mjs**: imports cron utilities; adds `Hostname` and `Next Backup` columns to the Tenant Overview table.
- **scripts/generate-report.mjs (NEW)**: a JS port of the inline bash that builds `reports/backup-summary-*.md`, accepting backup results as input and producing the same markdown report (now including Hostname + Next Backup).
- **.github/workflows/scheduled-backup.yml**: the summary job calls `node scripts/generate-report.mjs` instead of inlining ~50 lines of bash/jq.
- **scripts/test-parse-tenants.mjs** and **scripts/test-generate-dashboard.mjs**: extended to cover the new fields/columns.

No breaking changes. Existing tests that exercise the `tenants.yaml` schema continue to pass (the registry parser already tolerates unknown fields).

## Capabilities

### New Capabilities

- `cron-utils`: shared cron-expression utilities (`matchesCron`, `nextCronTime`, `previousCronTime`) extracted from `parse-tenants.mjs` so multiple scripts can compute schedule-related times without duplicating logic.
- `tenant-hostname-in-index`: optional `hostname` field in `tenants.yaml`, used purely as a display reference (not authoritative — authoritative URL still lives in `.tenant.yaml` on each tenant branch).

### Modified Capabilities

- `tenant-registry`: parser already accepts arbitrary key:value pairs; add an explicit requirement stating that `hostname` is recognised and surfaced verbatim, alongside the existing `schedule` and `description` support.
- `dashboard-generation`: Tenant Overview table gains `Hostname` and `Next Backup` columns.
- `backup-summary-report`: per-run summary table gains `Hostname` and `Next Backup` columns.

## Impact

- **Code**: `scripts/cron-utils.mjs`, `scripts/generate-report.mjs` (both new); `scripts/parse-tenants.mjs`, `scripts/generate-dashboard.mjs`, `scripts/tenant-registry.mjs`, `.github/workflows/scheduled-backup.yml` (modified).
- **Data**: `tenants.yaml` gains two fields per tenant. The CI matrix JSON gains one field (`hostname`).
- **Dependencies**: none. The work uses Node's built-in `child_process`, `fs`, and `path`.
- **Operators**: dashboard and report rows become self-explanatory at a glance; no workflow changes for tenants.
