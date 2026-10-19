## MODIFIED Requirements

### Requirement: Per-tenant cron schedule in registry

The system SHALL support an optional `schedule` field in `tenants.yaml` for each tenant, containing a cron expression that determines when the tenant's backup is eligible to run. A tenant SHALL only be included in the backup matrix when its schedule matches the current UTC time AND its backup is pending (not already completed for the current schedule window).

#### Scenario: Tenant with matching schedule is included in matrix
- **GIVEN** `tenants.yaml` contains tenant "company12926-poc" with `schedule: "0 6 * * 1"`
- **AND** the current UTC time is Monday 06:00
- **AND** the tenant has no backup tags
- **WHEN** `scripts/parse-tenants.mjs --active-only --check-schedule` runs
- **THEN** the output matrix includes "company12926-poc"

#### Scenario: Tenant with non-matching schedule is excluded from matrix
- **GIVEN** `tenants.yaml` contains tenant "company12926-poc" with `schedule: "0 6 * * 1"`
- **AND** the current UTC time is Tuesday 06:00
- **WHEN** `scripts/parse-tenants.mjs --active-only --check-schedule` runs
- **THEN** the output matrix does NOT include "company12926-poc"

#### Scenario: Tenant without schedule defaults to daily
- **GIVEN** `tenants.yaml` contains tenant "company21280-poc" with no `schedule` field
- **WHEN** `scripts/parse-tenants.mjs --active-only --check-schedule` runs at any time
- **THEN** the output matrix includes "company21280-poc"

#### Scenario: Manual dispatch bypasses schedule filter but respects pending check
- **GIVEN** the workflow is triggered via `workflow_dispatch` for tenant "company12926-poc"
- **AND** the current time does NOT match the tenant's schedule
- **AND** the tenant has no backup tags
- **WHEN** the prepare-matrix job runs
- **THEN** the tenant is included in the matrix because it is pending

#### Scenario: Already backed up tenant is excluded from manual run
- **GIVEN** the workflow is triggered via `workflow_dispatch` for tenant "company12926-poc"
- **AND** the tenant has a backup tag `company12926-poc/2024-01-01_06-00-00`
- **WHEN** the prepare-matrix job runs at 06:15 UTC on 2024-01-01
- **THEN** the tenant is NOT included in the matrix because its backup is up to date
