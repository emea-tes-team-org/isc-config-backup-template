# Design: ISC Tenant Onboarding GitHub Action

## Context

The repository already has a working multi-tenant backup system:

- `tenants.yaml` on `main` lists all onboarded tenants and their `active` status
- Each tenant has a dedicated branch, a GitHub Environment with the same name, and a `.tenant.yaml` descriptor on the branch
- `scheduled-backup.yml` reads `tenants.yaml` daily at 6:00 AM UTC and runs backups across all active tenants in parallel
- `backup.yml` provides a manual backup trigger that checks out scripts from `main` and backup data from the tenant branch
- `sync-workflows.yml` propagates workflow changes from `main` to all tenant branches
- `scripts/onboard.mjs` provides a local CLI that can perform onboarding, but it requires a developer to run Node.js locally with a GitHub PAT

The missing piece is a browser-based, self-service onboarding path. This change adds a GitHub Actions workflow that performs the same operations as `scripts/onboard.mjs` but is triggered from the GitHub UI.

## Goals / Non-Goals

**Goals:**
- Single `workflow_dispatch` to onboard a tenant with inputs: `api_url`, `client_id`, `client_secret`, optional `tenant_name`, `active`, `description`
- Credential validation before any resources are created
- Automated branch creation from `main`
- Automated GitHub Environment creation with secrets
- Commit `.tenant.yaml` and branch-specific `.gitignore` to the new tenant branch
- Append the new tenant to `tenants.yaml` on `main`
- Reuse the formats and conventions already established by `scripts/onboard.mjs`

**Non-Goals:**
- Replacing the existing `scripts/onboard.mjs` local CLI
- Replacing `tenants.yaml` with another format
- Replacing the centralized `scheduled-backup.yml` scheduler
- Cross-tenant restore via workflow inputs (separate change)
- Dashboard / status aggregation (separate change)

## Decisions

### 1. Reuse existing architecture instead of per-branch cron

**Decision:** The onboarding workflow integrates with the existing `tenants.yaml` registry and `scheduled-backup.yml` scheduler. It does not add per-branch cron schedules.

**Rationale:** The codebase already has a centralized scheduler that the team is using. Adding a second scheduling mechanism would create confusion and require removing or disabling `scheduled-backup.yml`. Reusing the existing architecture keeps the change focused and additive.

**Alternative considered:** Replacing `scheduled-backup.yml` with per-branch cron schedules. Rejected because it would be a larger refactor and would conflict with already-merged work.

### 2. GitHub-native secret management via `gh` CLI

**Decision:** Use the `gh` CLI (`gh secret set --env`) to create environment secrets, authenticated with an `ADMIN_TOKEN` repository secret.

**Rationale:** The `gh` CLI handles libsodium encryption transparently. This avoids duplicating the encryption logic in `scripts/onboard.mjs` and keeps the workflow readable.

**Alternative considered:** Reuse `scripts/onboard.mjs` directly in the workflow. Rejected because the script stores the PAT in `.github/.local-pat` and is designed for interactive local use; adapting it would require non-trivial changes.

### 3. ADMIN_TOKEN prerequisite

**Decision:** The onboarding workflow requires a pre-configured `ADMIN_TOKEN` repository secret containing a GitHub PAT with `repo` and `secrets` (or `admin:org`) scopes. The built-in `GITHUB_TOKEN` cannot manage environment secrets.

**Rationale:** This is a one-time setup cost per repository. GitHub's `GITHUB_TOKEN` is intentionally scoped to the current repository's Actions and cannot create or update environment-level secrets.

### 4. Branch metadata matches `scripts/onboard.mjs`

**Decision:** The workflow commits `.tenant.yaml` and `.gitignore` files that match the format produced by `scripts/onboard.mjs`, so existing workflows continue to work unchanged.

**Rationale:** Consistency with the existing onboarding CLI prevents subtle incompatibilities in `backup.yml`, `sync-workflows.yml`, drift detection, and the dashboard.

### 5. tenants.yaml append-only updates

**Decision:** The onboarding workflow appends a new tenant entry to `tenants.yaml` without reformatting the rest of the file.

**Rationale:** The existing parser in `scripts/parse-tenants.mjs` is line-oriented. Preserving the existing format avoids parser regressions.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| `ADMIN_TOKEN` not configured → onboarding workflow fails | Document the prerequisite prominently in README and workflow error messages |
| Concurrent onboarding runs update `tenants.yaml` simultaneously | Pull and rebase before committing; fail loudly if the tenant already exists in the registry |
| Workflow creates branch/environment but fails before updating `tenants.yaml` | The workflow fails with a clear error; a manual registry update or re-run with `--update` logic can recover. The branch/env without registry entry is harmless but not backed up |
| `.tenant.yaml` format drifts from `scripts/onboard.mjs` | Reuse the exact template used by the CLI; add a verification task to compare outputs |

## Migration Plan

1. Configure `ADMIN_TOKEN` repository secret (one-time)
2. Deploy `.github/workflows/onboarding.yml`
3. Update `README.md` with onboarding instructions
4. Existing tenants continue unaffected
5. New tenants are onboarded via `Actions → ISC Onboarding → Run workflow`
6. Optional: trigger `scheduled-backup.yml` manually for the new tenant to verify connectivity

No rollback needed — the change is additive. If the onboarding workflow is removed, existing tenants and the local CLI continue to work.

## Open Questions

- Should the onboarding workflow trigger `scheduled-backup.yml` automatically for the new tenant after registry update? The current design includes this as a goal but it could be made optional via an input.
