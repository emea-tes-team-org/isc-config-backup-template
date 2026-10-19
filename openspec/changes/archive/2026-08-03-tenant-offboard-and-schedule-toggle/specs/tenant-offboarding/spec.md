## ADDED Requirements

### Requirement: Offboard via GitHub Actions

The system SHALL provide a `workflow_dispatch` workflow on `main` named ISC Offboard that accepts `tenant_name` and a confirmation input matching the tenant name, and decommissions the tenant.

#### Scenario: Successful offboard removes tenant from registry

- **GIVEN** tenant "acme-prod" exists in `tenants.yaml`
- **WHEN** ISC Offboard runs on `main` with `tenant_name` = "acme-prod" and confirmation matching "acme-prod"
- **THEN** the "acme-prod" entry is removed from `tenants.yaml` on `main`
- **AND** the registry change is committed and pushed to `main`

#### Scenario: Offboard deletes all tenant backup tags

- **GIVEN** tenant "acme-prod" has git tags "acme-prod/2026-08-01_06-00-00" and "acme-prod/2026-08-02_06-00-00"
- **WHEN** ISC Offboard completes for "acme-prod"
- **THEN** no tags matching "acme-prod/*" remain on the remote repository

#### Scenario: Offboard squashes branch to single snapshot commit

- **GIVEN** tenant branch "acme-prod" has multiple backup commits
- **AND** the latest commit contains current files under `backups/acme-prod/`
- **WHEN** ISC Offboard completes for "acme-prod"
- **THEN** branch "acme-prod" exists with exactly one commit
- **AND** that commit's tree contains the same `backups/acme-prod/` content as the pre-offboard HEAD

#### Scenario: Offboard preserves tenant branch

- **GIVEN** tenant "acme-prod" is offboarded successfully
- **WHEN** `git ls-remote --heads origin acme-prod` is run
- **THEN** the branch ref exists on the remote

#### Scenario: Offboard sets active false in branch descriptor

- **GIVEN** tenant branch "acme-prod" contains `.tenant.yaml` with `active: true`
- **WHEN** ISC Offboard completes for "acme-prod"
- **THEN** `.tenant.yaml` on branch "acme-prod" contains `active: false`

#### Scenario: Offboard rejects unknown tenant

- **GIVEN** "unknown-tenant" is not listed in `tenants.yaml`
- **WHEN** ISC Offboard runs with `tenant_name` = "unknown-tenant"
- **THEN** the workflow fails before modifying the registry or tenant branch

#### Scenario: Offboard rejects confirmation mismatch

- **GIVEN** tenant "acme-prod" exists in `tenants.yaml`
- **WHEN** ISC Offboard runs with `tenant_name` = "acme-prod" and confirmation not equal to "acme-prod"
- **THEN** the workflow fails before making any changes

#### Scenario: Offboard runs on main only

- **GIVEN** the Offboard workflow is triggered on a branch that is not `main`
- **WHEN** the workflow starts
- **THEN** it fails immediately with a message indicating it must be run from `main`

### Requirement: Offboard preserves GitHub Environment

The Offboard action SHALL NOT delete the tenant's GitHub Environment or its secrets in v1.

#### Scenario: Environment remains after offboard

- **GIVEN** GitHub Environment "acme-prod" exists with secrets `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET`
- **WHEN** ISC Offboard completes for "acme-prod"
- **THEN** GitHub Environment "acme-prod" still exists with its secrets

### Requirement: Offboard CLI parity

The system SHALL expose offboard via `node scripts/cli.mjs offboard <tenant-name>` with the same decommission semantics as the GitHub Actions workflow.

#### Scenario: CLI offboard removes registry entry

- **GIVEN** tenant "acme-prod" exists in local `tenants.yaml`
- **WHEN** the developer runs `npm run cli -- offboard acme-prod` with confirmation
- **THEN** "acme-prod" is removed from local `tenants.yaml`
- **AND** the command reports tag deletion and branch squash steps
