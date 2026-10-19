## ADDED Requirements

### Requirement: Backup pending detection via latest tag

The system SHALL determine whether a tenant's scheduled backup is pending by comparing the tenant's latest backup tag timestamp against the tenant's scheduled time for the current day.

#### Scenario: Tenant with no prior backup is pending
- **GIVEN** tenant "company12926-poc" has no backup tags
- **WHEN** the pending check runs at 06:00 UTC
- **THEN** the tenant is considered pending

#### Scenario: Tenant already backed up today after scheduled time is not pending
- **GIVEN** tenant "company12926-poc" has a backup tag `company12926-poc/2024-01-01_06-00-00`
- **AND** the tenant schedule is `"0 6 * * *"`
- **WHEN** the pending check runs at 06:15 UTC on 2024-01-01
- **THEN** the tenant is NOT considered pending

#### Scenario: Tenant backed up yesterday is pending
- **GIVEN** tenant "company12926-poc" has a backup tag `company12926-poc/2023-12-31_06-00-00`
- **AND** the tenant schedule is `"0 6 * * *"`
- **WHEN** the pending check runs at 06:00 UTC on 2024-01-01
- **THEN** the tenant is considered pending

#### Scenario: Pending check respects schedule window
- **GIVEN** tenant "company12926-poc" has schedule `"0 6 * * *"`
- **WHEN** the pending check runs at 05:59 UTC on 2024-01-01
- **THEN** the tenant is NOT considered pending because the scheduled time has not arrived
