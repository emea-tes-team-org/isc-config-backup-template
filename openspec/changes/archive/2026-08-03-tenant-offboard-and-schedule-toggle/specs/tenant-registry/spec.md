## ADDED Requirements

### Requirement: Schedule toggle is the supported operator path for active changes

The system SHALL support changing a tenant's scheduled backup eligibility by flipping the `active` field via the Schedule Toggle workflow or CLI, without manual `tenants.yaml` edits.

#### Scenario: Toggled-off tenant excluded from matrix

- **GIVEN** tenant "acme-prod" has `active: false` in `tenants.yaml` after Schedule Toggle
- **WHEN** `node scripts/parse-tenants.mjs --active-only` runs
- **THEN** the output matrix does not include "acme-prod"

#### Scenario: Toggled-on tenant included in matrix

- **GIVEN** tenant "acme-prod" has `active: true` in `tenants.yaml` after Schedule Toggle
- **WHEN** `node scripts/parse-tenants.mjs --active-only` runs
- **THEN** the output matrix includes an entry for "acme-prod"

### Requirement: Offboard removes tenant from registry

The system SHALL remove a tenant entry from `tenants.yaml` when the Offboard workflow or CLI completes successfully.

#### Scenario: Offboarded tenant absent from parser output

- **GIVEN** tenant "acme-prod" was removed from `tenants.yaml` by Offboard
- **WHEN** `node scripts/parse-tenants.mjs --all` runs
- **THEN** the output matrix does not include "acme-prod"

## MODIFIED Requirements

### Requirement: Central tenant manifest on main

The system SHALL maintain a `tenants.yaml` file on the `main` branch that serves as the single source of truth for all onboarded ISC tenants. The file SHALL be updated by the onboarding workflow when a new tenant is successfully set up, by the Schedule Toggle workflow when backup eligibility changes, and by the Offboard workflow when a tenant is decommissioned, preserving the existing YAML list format used by `scripts/parse-tenants.mjs`, `scheduled-backup.yml`, and `sync-workflows.yml`.

#### Scenario: Manifest is appended on onboarding

- **GIVEN** `tenants.yaml` already contains an entry for "company12926-poc"
- **WHEN** a new tenant "company21280-poc" is onboarded
- **THEN** the file is updated to include the new tenant entry
- **AND** existing entries are preserved unchanged
- **AND** the updated file is committed and pushed to `main`

#### Scenario: Newly onboarded tenant is active by default

- **GIVEN** the onboarding workflow is triggered with `active` = true
- **WHEN** the workflow updates `tenants.yaml`
- **THEN** the new tenant entry contains `active: true`
- **AND** `scheduled-backup.yml` will include the tenant in its next daily matrix

#### Scenario: Manifest entry removed on offboard

- **GIVEN** `tenants.yaml` contains an entry for "acme-prod"
- **WHEN** Offboard completes for "acme-prod"
- **THEN** the "acme-prod" entry is removed from `tenants.yaml`
- **AND** other tenant entries are preserved unchanged
