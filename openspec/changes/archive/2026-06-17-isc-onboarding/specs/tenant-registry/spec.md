# Tenant Registry

## MODIFIED Requirements

### Requirement: Central tenant manifest on main

The system SHALL maintain a `tenants.yaml` file on the `main` branch that serves as the single source of truth for all onboarded ISC tenants. The file SHALL be updated by the onboarding workflow when a new tenant is successfully set up, preserving the existing YAML list format used by `scripts/parse-tenants.mjs`, `scheduled-backup.yml`, and `sync-workflows.yml`.

#### Scenario: Manifest is appended on onboarding

GIVEN `tenants.yaml` already contains an entry for "company12926-poc"
WHEN a new tenant "company21280-poc" is onboarded
THEN the file is updated to include the new tenant entry
AND existing entries are preserved unchanged
AND the updated file is committed and pushed to `main`

#### Scenario: Newly onboarded tenant is active by default

GIVEN the onboarding workflow is triggered with `active` = true
WHEN the workflow updates `tenants.yaml`
THEN the new tenant entry contains `active: true`
AND `scheduled-backup.yml` will include the tenant in its next daily matrix

## ADDED Requirements

### Requirement: Registry format compatibility

The onboarding workflow SHALL append tenants using the same list-item format that `scripts/parse-tenants.mjs` understands: each tenant is a list item with at least `name:` and `active:` fields.

#### Scenario: Parser recognizes newly added tenant

GIVEN a tenant "company21280-poc" has just been appended to `tenants.yaml` by the onboarding workflow
WHEN `node scripts/parse-tenants.mjs --active-only` is run
THEN the output matrix includes `{ tenant: "company21280-poc", branch: "company21280-poc", environment: "company21280-poc" }`
