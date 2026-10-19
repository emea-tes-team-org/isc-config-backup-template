## ADDED Requirements

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

## MODIFIED Requirements

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
- **AND** all "acme-prod/*" backup tags are deleted
- **AND** branch "acme-prod" is squashed to a single snapshot commit
