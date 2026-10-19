## Why

ISC Lifecycle combines four operations in one GitHub Actions dispatch form, but GitHub cannot show or hide inputs based on the selected operation. Operators running schedule-toggle, verify, or offboard still see onboard credentials, confirmation fields, and other inputs that do not apply — creating confusion and eroding trust in the self-service UX.

Per-tenant shortcut workflows already exist for backup and toggle, but verify and offboard still route through the mega-form. The README duplicates tenant actions in a separate shortcuts table below the fleet status table, forcing operators to scroll and choose between two places for the same operations.

This change completes the thin-wrapper pattern for all tenant-scoped lifecycle actions, embeds those actions directly in the fleet table, and simplifies offboard confirmation to a single keyword gate.

## What Changes

**Per-tenant wrapper workflows**
- From: backup and toggle wrappers only; offboard links to `isc-lifecycle.yml` with manual operation selection
- To: generated wrappers for backup, toggle, verify, and offboard per registry tenant
- Reason: tenant identity belongs in the workflow name, not a form field
- Impact: non-breaking for CLI; ~2 new generated workflow files per tenant

**Offboard confirmation**
- From: operator types tenant name twice (`tenant` + `confirm_tenant`) in lifecycle form
- To: per-tenant offboard wrapper requires typing `offboard`; wrapper auto-dispatches lifecycle with tenant pre-set
- Reason: clearer destructive intent without re-typing tenant name
- Impact: non-breaking for direct lifecycle offboard path; README path uses new confirmation

**Fleet table actions column**
- From: Tenant Overview table shows status only; separate Per-tenant shortcuts table below Quick Actions
- To: Actions column in fleet table with inline links (Backup · Toggle · Verify · Offboard)
- Reason: one place to see fleet status and act on a tenant
- Impact: non-breaking; generated README layout change

**README generation**
- From: `generate-readme.mjs` renders duplicate shortcuts subsection
- To: actions embedded via `generate-dashboard.mjs`; shortcuts subsection removed
- Reason: eliminate duplication
- Impact: non-breaking for automation; visual README change

## Capabilities

### New Capabilities

_(none — reuse existing capabilities)_

### Modified Capabilities

- `operations-dashboard`: fleet table includes per-tenant action links; remove separate shortcuts table; deep links target wrapper workflows
- `tenant-lifecycle`: offboard via per-tenant wrapper with `offboard` keyword confirmation; verify via zero-input per-tenant wrapper

## Impact

- **Scripts:** `generate-tenant-shortcuts.mjs` (verify + offboard wrappers), `generate-dashboard.mjs` (Actions column), `generate-readme.mjs` (remove shortcuts section, pass repo slug to dashboard)
- **Generated files:** `isc-verify-{tenant}.yml`, `isc-offboard-{tenant}.yml` per tenant; regenerated `README.md`
- **Workflows:** no changes to `isc-lifecycle.yml` job logic; wrappers dispatch into existing lifecycle operations
- **Tests:** `test-generate-tenant-shortcuts.mjs`, `test-generate-dashboard.mjs`, `test-generate-readme.mjs`
- **GitHub UI:** operators use wrapper workflows from README fleet table; ISC Lifecycle card de-emphasized for tenant ops
- **CLI:** unchanged — `cli.mjs verify`, `schedule-toggle`, `offboard` remain available for local parity
