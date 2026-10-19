# Proposal: ISC Tenant Onboarding GitHub Action

## Why

The repository already has a local CLI (`scripts/onboard.mjs`) that can onboard tenants, but it requires a developer to run Node.js locally with a GitHub PAT. Teams need a self-service, browser-based way to onboard tenants directly from GitHub Actions. Adding a `workflow_dispatch` onboarding workflow removes the local-tool dependency and makes tenant onboarding accessible to anyone with workflow run permissions.

## What Changes

- **New workflow**: `.github/workflows/onboarding.yml` — single `workflow_dispatch` that accepts `tenant_name` (auto-derived from `api_url` if omitted), `api_url`, `client_id`, `client_secret`, `active`, and `description` as inputs
- **Credential validation**: before creating any resources, the workflow validates `client_id`/`client_secret` against the ISC tenant's `/oauth/token` endpoint. Failure stops the pipeline with a clear error — nothing is created on bad credentials
- **Automated branch creation**: creates a branch named after the tenant from `main`
- **Automated environment + secrets**: creates a GitHub Environment matching the tenant name and sets `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET` as environment-scoped secrets
- **Branch descriptor**: commits `.tenant.yaml` and a branch-specific `.gitignore` to the new tenant branch, matching the format produced by `scripts/onboard.mjs`
- **Registry update**: appends the new tenant to the existing `tenants.yaml` registry on `main`
- **Optional first backup**: after onboarding, the workflow can trigger `scheduled-backup.yml` for the new tenant so the first backup runs immediately rather than waiting for the next 6:00 AM UTC schedule
- **README update**: document how to configure the required `ADMIN_TOKEN` secret and run the onboarding workflow from the GitHub UI

## Capabilities

### New Capabilities
- `isc-tenant-onboarding`: automated GitHub Actions workflow that validates credentials, creates a tenant branch, sets up the GitHub Environment with secrets, commits branch metadata, and registers the tenant in `tenants.yaml`

### Modified Capabilities
- `tenant-registry`: the existing `tenants.yaml` registry is updated by the onboarding workflow instead of being edited manually or via the local CLI

## Impact

- Affects: `.github/workflows/onboarding.yml` (new), `README.md` (documentation)
- Dependencies: requires an `ADMIN_TOKEN` repository secret — a GitHub PAT with `repo` and `secrets` (or `admin:org`) scopes — to manage environments and secrets. `GITHUB_TOKEN` cannot create environment secrets
- No breaking changes to existing workflows, `scripts/onboard.mjs`, `tenants.yaml`, `.tenant.yaml`, or tenant branches
