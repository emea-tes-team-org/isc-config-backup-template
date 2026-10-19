# Tenant Lifecycle

## Purpose

Foundational specification for onboarding, verifying, and registering ISC tenants. Governs how tenant identity propagates across git branches, GitHub Environments, and the central registry on `main`.

Child capabilities: `isc-tenant-onboarding`, `onboarding-verification`, `tenant-registry`, `tenant-description-in-index`, `tenant-hostname-in-index`.
## Requirements
### Requirement: Tenant name is the single source of truth

The system SHALL use the tenant name consistently as the git branch name, GitHub Environment name, backup folder path (`backups/<tenant-name>/`), and primary key in `tenants.yaml`.

#### Scenario: Tenant artifacts share one identifier

- **GIVEN** a tenant named "acme-prod" is onboarded
- **WHEN** the onboarding workflow completes successfully
- **THEN** a git branch "acme-prod" exists
- **AND** a GitHub Environment "acme-prod" exists
- **AND** backup commits target `backups/acme-prod/` on that branch
- **AND** an entry for "acme-prod" exists in `tenants.yaml` on `main`

### Requirement: Self-service onboarding from GitHub UI

The system SHALL allow operators to onboard a new ISC tenant entirely through **Actions > ISC Onboarding > Run workflow** without local tooling, and to pause or decommission tenants through **Actions > ISC Schedule Toggle** and **Actions > ISC Offboard** without local tooling.

#### Scenario: Onboarding via workflow dispatch

- **GIVEN** the `ADMIN_TOKEN` repository secret is configured
- **WHEN** an operator runs ISC Onboarding with valid `api_url`, `client_id`, and `client_secret`
- **THEN** credentials are validated against the ISC OAuth endpoint
- **AND** the tenant branch, environment, secrets, `.tenant.yaml`, `.gitignore`, and registry entry are created
- **AND** the tenant is eligible for the next scheduled backup matrix run

#### Scenario: Schedule toggle via workflow dispatch

- **GIVEN** tenant "acme-prod" is registered with `active: true`
- **WHEN** an operator runs ISC Schedule Toggle with `tenant_name` = "acme-prod"
- **THEN** `tenants.yaml` on `main` is updated with `active: false`
- **AND** no branch or tag data is modified

#### Scenario: Offboard via workflow dispatch

- **GIVEN** tenant "acme-prod" is registered and has backup history
- **WHEN** an operator runs ISC Offboard with matching confirmation
- **THEN** the tenant is removed from `tenants.yaml`
- **AND** all "acme-prod/*" backup tags except the latest by name-embedded UTC timestamp are deleted
- **AND** the latest "acme-prod/*" backup tag remains when at least one valid backup tag existed
- **AND** branch "acme-prod" is squashed to a single snapshot commit

### Requirement: Onboarding runs on main only

The onboarding workflow SHALL only execute when triggered against the `main` branch, since `main` holds the authoritative tenant registry and is the branch from which tenant branches are created.

#### Scenario: Non-main trigger is rejected

- **GIVEN** the onboarding workflow is triggered on a branch that is not `main`
- **WHEN** the workflow starts
- **THEN** it fails immediately with a message indicating it must be run from `main`

### Requirement: Tenant descriptor on each branch

Each tenant branch SHALL carry a `.tenant.yaml` file containing at minimum `name`, `url`, `active`, and optional `description`.

#### Scenario: Descriptor matches registry entry

- **GIVEN** tenant "acme-prod" is onboarded with description "Production tenant"
- **WHEN** `.tenant.yaml` on branch "acme-prod" is read
- **THEN** `name` equals "acme-prod"
- **AND** `url` matches the ISC API base URL used during onboarding
- **AND** `active` reflects the onboarding input

### Requirement: Branch-specific gitignore isolates backup data

Each tenant branch SHALL contain a `.gitignore` that ignores all `backups/*` except `backups/<tenant-name>/`.

#### Scenario: Only tenant backup folder is tracked

- **GIVEN** tenant branch "acme-prod" exists
- **WHEN** backup data is written to `backups/acme-prod/`
- **THEN** those files are tracked by git
- **AND** files under `backups/other-tenant/` are ignored if present

### Requirement: Post-onboarding verification

The system SHALL provide a verification command (`npm run cli -- verify <tenant>`) that checks branch, environment, secrets, `.tenant.yaml`, `.gitignore`, and registry presence.

#### Scenario: Verification passes for fully onboarded tenant

- **GIVEN** tenant "acme-prod" was successfully onboarded
- **WHEN** `npm run cli -- verify acme-prod` is run with authenticated `gh` CLI
- **THEN** all artifact checks report PASSED
- **AND** the command exits with code 0

### Requirement: Central tenant registry on main

The system SHALL maintain `tenants.yaml` on `main` as the lightweight index of all onboarded tenants, updated automatically by onboarding and consumed by scheduling and sync workflows.

#### Scenario: Registry drives scheduled backup inclusion

- **GIVEN** `tenants.yaml` lists tenant "acme-prod" with `active: true`
- **WHEN** the scheduled backup matrix runs for matching schedule window
- **THEN** "acme-prod" is included in the backup matrix

### Requirement: Tenant offboarding completes the lifecycle

The system SHALL provide an offboard action that decommissions a tenant while preserving the tenant branch as an archival snapshot of the latest backup.

#### Scenario: Offboarded tenant excluded from scheduled backups

- **GIVEN** tenant "acme-prod" was offboarded and removed from `tenants.yaml`
- **WHEN** the scheduled backup matrix runs
- **THEN** "acme-prod" is not included in the backup matrix

#### Scenario: Offboarded branch remains restorable as source

- **GIVEN** tenant "acme-prod" was offboarded and branch "acme-prod" retains backup data at HEAD
- **WHEN** an operator triggers ISC Restore using branch "acme-prod" as the workflow source ref
- **AND** a valid target tenant is registered in `tenants.yaml`
- **THEN** restore reads backup data from branch "acme-prod" HEAD

#### Scenario: Offboarded tenant cannot be restore target

- **GIVEN** tenant "acme-prod" was offboarded and removed from `tenants.yaml`
- **WHEN** an operator runs ISC Restore with target tenant "acme-prod"
- **THEN** the workflow fails validation before restore executes

