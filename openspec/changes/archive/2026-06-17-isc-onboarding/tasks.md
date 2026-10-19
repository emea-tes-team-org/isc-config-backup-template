# Tasks: ISC Tenant Onboarding GitHub Action

## 1. Repository Prerequisites

- [x] 1.1 Document `ADMIN_TOKEN` prerequisite in README.md — a GitHub PAT with `repo` and `secrets` scopes must be configured as a repository secret before the workflow can create environments and secrets

## 2. Onboarding Workflow

- [x] 2.1 Create `.github/workflows/onboarding.yml` with `workflow_dispatch` trigger and inputs: `api_url` (required), `client_id` (required), `client_secret` (required), `tenant_name` (optional, derived from `api_url` if blank), `active` (boolean, default true), `description` (optional)
- [x] 2.2 Add guard: fail immediately if `github.ref_name` is not `main`
- [x] 2.3 Implement tenant name extraction from `api_url` (parse hostname, take first subdomain — matching `common.mjs` and `scripts/onboard.mjs`)
- [x] 2.4 Validate tenant name format: lowercase alphanumeric and hyphens, no leading/trailing hyphen
- [x] 2.5 Implement credential validation step: call `POST {api_url}/oauth/token` with the provided `client_id` and `client_secret`; fail with clear error message on non-200 response before creating any resources
- [x] 2.6 Implement duplicate check: read `tenants.yaml` from `main` and fail if the extracted tenant name already exists
- [x] 2.7 Implement branch creation: checkout `main`, create a new branch named after the tenant, push it to origin
- [x] 2.8 Implement environment creation: call GitHub REST API `PUT /repos/{owner}/{repo}/environments/{tenant_name}` using `ADMIN_TOKEN` via `gh api`
- [x] 2.9 Implement secret provisioning: set `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET` as environment-scoped secrets using `gh secret set --env {tenant_name}` authenticated with `ADMIN_TOKEN`
- [x] 2.10 Commit `.tenant.yaml` to the new tenant branch with `name`, `url`, `active`, and `description` fields, matching the format produced by `scripts/onboard.mjs`
- [x] 2.11 Commit branch-specific `.gitignore` to the new tenant branch that ignores all `backups/*` except `backups/{tenant_name}/`, matching `scripts/onboard.mjs`
- [x] 2.12 Implement `tenants.yaml` update: checkout `main`, append the new tenant entry (name, active), commit, and push. Pull/rebase first to handle concurrent onboarding
- [x] 2.13 Add summary output at workflow completion listing all created resources (branch name, environment name, registry entry)

## 3. Documentation

- [x] 3.1 Update README.md: add a section explaining how to configure `ADMIN_TOKEN` and run the onboarding workflow from the GitHub UI
- [x] 3.2 Add inline comments to `onboarding.yml` explaining each step's purpose and the `ADMIN_TOKEN` dependency

## 4. Validation

- [x] 4.1 Run `openspec validate isc-onboarding --type change --strict` and verify clean output
- [x] 4.2 Run `yamllint` or basic YAML syntax check on `.github/workflows/onboarding.yml` if available
- [x] 4.3 Verify `node scripts/parse-tenants.mjs --active-only` still correctly parses `tenants.yaml` after appending a tenant entry
- [x] 4.4 Verify the `.tenant.yaml` and `.gitignore` formats match what `scripts/onboard.mjs` generates
- [ ] 4.5 End-to-end test: onboard a test tenant via the workflow, verify branch/environment/secrets/tenants.yaml are created, then run `scheduled-backup.yml` for the tenant to confirm backup connectivity (requires running the workflow on GitHub)
