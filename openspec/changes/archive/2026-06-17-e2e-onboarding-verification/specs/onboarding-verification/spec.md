# Onboarding Verification

## ADDED Requirements

### Requirement: Verify all onboarding artifacts for a tenant

The system SHALL provide a verification script (`scripts/verify-onboarding.mjs`) that accepts a tenant name and checks all artifacts created by the onboarding workflow, reporting pass or fail for each check.

#### Scenario: All checks pass for correctly onboarded tenant

- **GIVEN** a tenant "company12926-poc" was successfully onboarded via the onboarding workflow
- **WHEN** the verification script is run with `node scripts/verify-onboarding.mjs company12926-poc`
- **THEN** the script reports the tenant branch exists on origin
- **AND** the script reports the GitHub Environment "company12926-poc" exists
- **AND** the script reports secrets `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET` are present in the environment
- **AND** the script reports `.tenant.yaml` on the branch contains valid `name`, `url`, `active`, and `description` fields
- **AND** the script reports `.gitignore` on the branch ignores all `backups/*` except `backups/company12926-poc/`
- **AND** the script reports the tenant is listed in `tenants.yaml` on `main`
- **AND** the script exits with code 0

#### Scenario: Missing branch detected

- **GIVEN** no branch named "nonexistent-tenant" exists in the repository
- **WHEN** the verification script is run with `node scripts/verify-onboarding.mjs nonexistent-tenant`
- **THEN** the script reports the branch check as FAILED
- **AND** the script skips subsequent checks that depend on the branch (`.tenant.yaml`, `.gitignore`)
- **AND** the script exits with a non-zero code

#### Scenario: Missing environment detected

- **GIVEN** a branch "partial-tenant" exists but no GitHub Environment with that name exists
- **WHEN** the verification script is run with `node scripts/verify-onboarding.mjs partial-tenant`
- **THEN** the script reports the branch check as PASSED
- **AND** the script reports the environment check as FAILED
- **AND** the script exits with a non-zero code

#### Scenario: Missing secrets detected

- **GIVEN** a tenant "incomplete-tenant" has a branch and environment but the environment is missing `CLIENT_SECRET`
- **WHEN** the verification script is run with `node scripts/verify-onboarding.mjs incomplete-tenant`
- **THEN** the script reports the branch and environment checks as PASSED
- **AND** the script reports the secrets check as FAILED with a message indicating which secrets are missing
- **AND** the script exits with a non-zero code

#### Scenario: Incorrect .tenant.yaml detected

- **GIVEN** a tenant branch contains a `.tenant.yaml` file missing the required `url` field
- **WHEN** the verification script is run for that tenant
- **THEN** the script reports the `.tenant.yaml` check as FAILED with a message indicating which field is missing
- **AND** the script exits with a non-zero code

#### Scenario: Incorrect .gitignore detected

- **GIVEN** a tenant branch contains a `.gitignore` that does not include the tenant-specific `backups/<tenant>/` exception
- **WHEN** the verification script is run for that tenant
- **THEN** the script reports the `.gitignore` check as FAILED
- **AND** the script exits with a non-zero code

#### Scenario: Tenant not in registry

- **GIVEN** a tenant "orphan-tenant" has a branch and environment but is not listed in `tenants.yaml` on `main`
- **WHEN** the verification script is run with `node scripts/verify-onboarding.mjs orphan-tenant`
- **THEN** the script reports the registry check as FAILED
- **AND** the script exits with a non-zero code

### Requirement: Prerequisite check for gh CLI authentication

The system SHALL fail early with a clear message if the `gh` CLI is not authenticated or lacks the required scopes.

#### Scenario: gh CLI not authenticated

- **GIVEN** the `gh` CLI is not authenticated (`gh auth status` returns non-zero)
- **WHEN** the verification script is run
- **THEN** the script exits immediately with a message instructing the user to run `gh auth login` with a token that has `repo` scope
- **AND** no checks are performed

### Requirement: Optional backup verification

The system SHALL support an optional `--backup` flag that triggers a backup workflow for the given tenant and verifies backup artifacts were committed.

#### Scenario: Backup verification invoked with --backup flag

- **GIVEN** a tenant "company12926-poc" passes all artifact checks
- **AND** the `--backup` flag is provided
- **WHEN** the verification script dispatches `scheduled-backup.yml` for the tenant via the GitHub Actions API
- **THEN** the script polls for workflow completion
- **AND** the script checks the tenant branch for committed backup artifacts
- **AND** the script reports whether backup artifacts were found

#### Scenario: --backup flag omitted skips backup check

- **GIVEN** a tenant passes all artifact checks
- **AND** the `--backup` flag is NOT provided
- **WHEN** the verification script runs
- **THEN** no backup workflow is dispatched
- **AND** the script reports backup verification was skipped
