# ADR-0001: Branch-Per-Tenant with Per-Branch Cron Scheduling

## Status

accepted

## Context

The ISC Config Hub CI/CD system backs up multiple ISC tenants. Each tenant requires isolated credentials (TENANT_URL, CLIENT_ID, CLIENT_SECRET) and produces independent backup snapshots. The system must support daily scheduled backups with staggered execution times to avoid API rate limiting and provide a clean audit trail per tenant.

GitHub Actions provides two mechanisms for isolating secrets: repository-level secrets and environment-level secrets (scoped to a named GitHub Environment). Environments can be referenced dynamically via `environment: ${{ github.ref_name }}`, allowing a single workflow definition to resolve different secrets depending on which branch it runs on.

GitHub Actions cron schedules (`schedule:`) are static per workflow file and cannot be parameterized or computed at runtime. Each branch's workflow file is independent.

## Decision

**Each ISC tenant is represented by a dedicated git branch.** The branch name matches the tenant name extracted from the tenant's API URL hostname (e.g., `company12926-poc`). A corresponding GitHub Environment with the same name stores the tenant's secrets.

**The backup schedule is baked into each branch's `backup.yml` at onboarding time.** The cron expression is computed as `{utcMinute} {utcHour} * * *` — the minute and hour at which the onboarding workflow runs. This means each tenant's daily backup fires at the time they were onboarded, providing natural stagger without a central coordinator.

The `backup.yml` on `main` serves as an un-scheduled template (cron is commented out), ensuring the canonical workflow definition lives in one place. Onboarding copies it into the new branch with the cron activated.

## Consequences

**Positive:**
- No coordinator workflow needed — each branch is self-contained and independently verifiable
- Natural stagger from different onboarding times across tenants
- Git history per tenant is clean and isolated (no merge conflicts between tenants' backup data)
- Secrets are scoped to Environments, not shared across tenants
- A tenant can be removed by deleting its branch and environment — no other artifacts to clean up

**Negative:**
- Workflow definition changes (e.g., backup script updates) must be propagated to each tenant branch manually or via re-onboarding
- Cannot dynamically reschedule a tenant's backup time without a new commit to that branch
- Adding a new workflow (e.g., a future validation check) requires propagating it to all tenant branches or relying on re-onboarding

## Supersedes

None (initial ADR).
