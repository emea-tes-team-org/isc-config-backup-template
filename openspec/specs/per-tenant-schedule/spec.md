# per-tenant-schedule Specification

## Purpose
Define and enforce individual backup windows per tenant via `tenants.yaml`, allowing tenants to specify cron expressions that determine when their backup is eligible to run.
## Requirements
### Requirement: Per-tenant cron schedule in registry

The system SHALL support an optional `schedule` field in `tenants.yaml` for each tenant, containing a cron expression that determines when the tenant's backup is eligible to run. On **cron-triggered** scheduled backup runs, a tenant SHALL only be included in the backup matrix when its schedule matches the current UTC time AND its backup is pending (not already completed for the current schedule window). On **workflow_dispatch** without a specific tenant input, only the pending check SHALL apply (schedule filter bypassed for operator catch-up).

#### Scenario: Tenant with matching schedule is included in matrix
- **GIVEN** `tenants.yaml` contains tenant "company12926-poc" with `schedule: "0 6 * * 1"`
- **AND** the current UTC time is Monday 06:00
- **AND** the tenant has no backup tags
- **WHEN** `scripts/parse-tenants.mjs --active-only --check-schedule --check-pending` runs on a cron-triggered workflow
- **THEN** the output matrix includes "company12926-poc"

#### Scenario: Tenant with non-matching schedule is excluded from matrix
- **GIVEN** `tenants.yaml` contains tenant "company12926-poc" with `schedule: "0 6 * * 1"`
- **AND** the current UTC time is Tuesday 06:00
- **WHEN** the prepare-matrix job runs on a cron-triggered workflow
- **THEN** the output matrix does NOT include "company12926-poc"

#### Scenario: Tenant without schedule defaults to daily
- **GIVEN** `tenants.yaml` contains tenant "company21280-poc" with no `schedule` field
- **WHEN** `scripts/parse-tenants.mjs --active-only --check-schedule` runs at 00:00 UTC
- **THEN** the output matrix includes "company21280-poc"
- **AND WHEN** the same command runs at 14:00 UTC
- **THEN** the output matrix does NOT include "company21280-poc"

#### Scenario: Manual dispatch bypasses schedule filter but respects pending check
- **GIVEN** the workflow is triggered via `workflow_dispatch` without a tenant input
- **AND** the current time does NOT match tenant "company12926-poc"'s schedule
- **AND** the tenant has no backup tags
- **WHEN** the prepare-matrix job runs
- **THEN** the tenant is included in the matrix because it is pending

#### Scenario: Manual dispatch with tenant input bypasses all filters
- **GIVEN** the workflow is triggered via `workflow_dispatch` with tenant input "company12926-poc"
- **AND** the current time does NOT match the tenant's schedule
- **WHEN** the prepare-matrix job runs
- **THEN** the tenant is included in the matrix regardless of schedule or pending status

#### Scenario: Already backed up tenant is excluded from manual run
- **GIVEN** the workflow is triggered via `workflow_dispatch` without a tenant input
- **AND** tenant "company12926-poc" has a backup tag `company12926-poc/2024-01-01_06-00-00`
- **WHEN** the prepare-matrix job runs at 06:15 UTC on 2024-01-01
- **THEN** the tenant is NOT included in the matrix because its backup is up to date

