# Tasks: E2E Onboarding Verification

## 1. Script Scaffolding

- [x] 1.1 Create `scripts/verify-onboarding.mjs` with shebang (`#!/usr/bin/env node`), argument parsing for `<tenant-name>` positional and `--backup` flag
- [x] 1.2 Add `gh` CLI prerequisite check: run `gh auth status` and exit early with clear message if not authenticated
- [x] 1.3 Define a check-result data structure (`{ check, status, detail }`) and a summary function that prints pass/fail per check and exits with non-zero if any check failed

## 2. Branch Verification

- [x] 2.1 Implement branch existence check: run `git ls-remote --heads origin <tenant-name>` and report pass if the ref exists, fail otherwise
- [x] 2.2 On branch check failure, skip file-content checks (`.tenant.yaml`, `.gitignore`) that depend on the branch

## 3. GitHub Environment Verification

- [x] 3.1 Implement environment existence check: run `gh api repos/{owner}/{repo}/environments/<tenant-name>` and report pass on 200, fail on 404
- [x] 3.2 Handle rate limiting: if the API returns 403/429, report a warning and suggest retry rather than failing

## 4. Environment Secrets Verification

- [x] 4.1 Check that `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET` secrets exist in the environment via `gh secret list --env <tenant-name>`
- [x] 4.2 Report which secrets are missing if any are absent

## 5. Branch Metadata Verification

- [x] 5.1 Clone or fetch the tenant branch locally and read `.tenant.yaml`
- [x] 5.2 Parse `.tenant.yaml` (using js-yaml from existing dependencies in package.json) and verify required fields: `name` (matches tenant name), `url` (non-empty string), `active` (boolean), `description` (string)
- [x] 5.3 Read `.gitignore` from the branch and verify it contains a line ignoring `backups/*` and an exception for `backups/<tenant-name>/`

## 6. Registry Verification

- [x] 6.1 Read `tenants.yaml` from `main` (via `git show origin/main:tenants.yaml`)
- [x] 6.2 Parse `tenants.yaml` and verify the tenant name appears with correct `active` status matching the `.tenant.yaml` value

## 7. Backup Verification (Opt-in)

- [x] 7.1 When `--backup` is provided, dispatch `scheduled-backup.yml` via `gh workflow run scheduled-backup.yml --ref main -f tenant=<tenant-name>`
- [x] 7.2 Poll workflow run status via `gh run list --workflow=scheduled-backup.yml --limit=1` and `gh run view <run-id>` to wait for completion or timeout
- [x] 7.3 After workflow completes, check the tenant branch for committed backup artifacts under `backups/<tenant-name>/`

## 8. Documentation

- [x] 8.1 Update `README.md`: add a "Verifying Onboarding" section with prerequisites (`gh auth login` with `repo` scope), usage examples, and expected output
- [x] 8.2 Add inline comments to `verify-onboarding.mjs` explaining each check

## 9. Validation

- [x] 9.1 Run `openspec validate e2e-onboarding-verification --type change --strict` and verify clean output
- [x] 9.2 Run `node scripts/verify-onboarding.mjs --help` to confirm argument parsing and help output
- [x] 9.3 Test against an existing onboarded tenant (`company12926-poc`) — script correctly reports 6/7 checks passed; the lone failure is a real `.gitignore` mismatch on that branch
- [x] 9.4 Test against a non-existent tenant name and verify correct failure reporting
- [x] 9.5 Run `openspec schema validate intent-driven` (the available schema-validation command) and verify clean output
