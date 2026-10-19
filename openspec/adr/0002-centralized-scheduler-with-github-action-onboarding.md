# ADR-0002: Centralized Scheduler with GitHub Actions Onboarding

## Status

accepted, supersedes ADR-0001

## Context

ADR-0001 proposed a branch-per-tenant model where each tenant branch would own its `backup.yml` with a per-branch cron schedule. At the time, the repository had no centralized scheduler.

Since then, the repository has adopted:
- `tenants.yaml` on `main` as a lightweight registry of onboarded tenants
- `scheduled-backup.yml` as a centralized workflow that runs daily at 6:00 AM UTC and dispatches backups for all active tenants in parallel using a matrix strategy
- `scripts/onboard.mjs` as a local CLI for onboarding tenants
- `.tenant.yaml` and branch-specific `.gitignore` files committed to each tenant branch

The team now needs a browser-based onboarding path via GitHub Actions.

## Decision

**Keep the centralized scheduler.** Each tenant continues to be represented by a dedicated branch and a GitHub Environment with the same name, but daily backups are coordinated by `scheduled-backup.yml` reading `tenants.yaml`, not by per-branch cron schedules.

**Add a GitHub Actions onboarding workflow** (`.github/workflows/onboarding.yml`) that creates the tenant branch, environment, secrets, branch metadata, and updates `tenants.yaml` so the new tenant is included in the centralized schedule.

## Consequences

**Positive:**
- Reuses already-working infrastructure (`tenants.yaml`, `scheduled-backup.yml`, `.tenant.yaml`)
- Single place to understand when backups run (6:00 AM UTC in `scheduled-backup.yml`)
- Self-service onboarding from the GitHub UI
- Existing local CLI (`scripts/onboard.mjs`) remains usable

**Negative:**
- All tenants back up at the same UTC time, not staggered by onboarding time
- The onboarding workflow cannot fully run without an `ADMIN_TOKEN` secret

## Supersedes

ADR-0001: Branch-Per-Tenant with Per-Branch Cron Scheduling. The per-branch cron approach is no longer pursued; the branch-per-tenant model is retained but scheduling is centralized.
