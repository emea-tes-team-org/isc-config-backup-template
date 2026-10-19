## MODIFIED Requirements

### Requirement: Operator dashboard generation

The system SHALL generate a dashboard (via `dashboard.yml` workflow) that gives operators a consolidated view of tenant backup status and schedules.

#### Scenario: Dashboard workflow produces output

- **GIVEN** multiple tenants are registered in `tenants.yaml`
- **WHEN** the dashboard generation workflow runs
- **THEN** a dashboard artifact is produced reflecting tenant names, schedules, and recent backup status

#### Scenario: Dashboard marks failed backup attempts as not healthy

- **GIVEN** the scheduled backup matrix recorded `failed` for tenant `ksb` in the current run's backup results
- **WHEN** the summary job generates the operations dashboard
- **THEN** the Tenant Overview row for `ksb` shows a non-healthy State (e.g. `⚠️ Backup failed`)
- **AND** the dashboard generation step consumed the matrix backup results for that run
