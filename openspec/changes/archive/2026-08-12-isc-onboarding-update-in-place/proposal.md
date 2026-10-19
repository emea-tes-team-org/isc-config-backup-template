# Proposal: ISC Onboarding Update In Place

## Why

The ISC Onboarding GitHub Actions workflow fails when a tenant already exists — either in `tenants.yaml` or as a remote branch — even though the local `onboard.mjs` CLI already supports idempotent create-or-update. This blocks secret refresh, metadata updates, and re-onboarding after offboard from the primary GitHub UI surface.

Operators who offboard a tenant (registry removed, branch and environment preserved) cannot restore scheduling and credentials via Actions without manual CLI steps or hand-editing secrets. The CLI and workflow have diverged, causing repeated operational friction.

## What Changes

- **Remove duplicate rejection** — delete the workflow step that fails when tenant exists in `tenants.yaml` or branch exists on `origin`
- **Idempotent upsert behavior** — onboarding workflow creates resources when absent and updates them when present, matching `onboard.mjs`
- **Shared onboarding execution** — workflow invokes shared Node onboarding logic after credential validation instead of parallel bash steps
- **Branch safety** — existing tenant branches are checked out and receive metadata commits only; branch is never recreated from `main` when it already exists
- **Registry merge** — `tenants.yaml` updates preserve `schedule`, `environment`, and backup tuning fields on existing entries
- **Workflow summary** — report whether the run created or updated the tenant
- **Tests** — extend workflow reference tests and add unit tests for upsert/registry merge scenarios
- **Spec delta** — replace duplicate-rejection requirement with update-in-place and re-onboard scenarios

**Onboarding workflow behavior**
- From: fails if tenant name in `tenants.yaml` or branch exists on `origin`
- To: validates credentials, then creates or updates branch metadata, environment secrets, and registry entry
- Reason: parity with CLI; enable re-onboard and secret refresh from GitHub UI
- Impact: non-breaking for net-new tenants; existing tenants become onboardable again via Actions

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `isc-tenant-onboarding`: onboarding workflow SHALL upsert existing tenants in place instead of rejecting duplicates; re-onboard after offboard SHALL restore registry entry and refresh secrets without recreating branch from main

## Impact

- **Modified files:** `.github/workflows/onboarding.yml`, `scripts/onboard.mjs` (or new workflow entry module), `scripts/test-workflow-references.mjs`, new/extended test script for upsert behavior
- **Unchanged:** offboard behavior (still preserves environment); backup/restore workflows; `tenants.yaml` schema
- **Operator UX:** ISC Onboarding works for new tenants, secret rotation, and post-offboard re-onboard
- **Secrets:** `ADMIN_TOKEN` still required; environment secrets overwritten on update runs
