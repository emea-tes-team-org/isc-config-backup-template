## MODIFIED Requirements

### Requirement: Backup pending detection via latest tag

The system SHALL determine whether a tenant's scheduled backup is pending by comparing the tenant's effective latest backup time against the tenant's most recent scheduled time for the current window. Effective latest backup time SHALL be the maximum of: (a) the latest restore-point tag name-embedded timestamp, and (b) the timestamp of the most recent `backup: YYYY-MM-DD` commit on the tenant branch when no tag exists for the current window. Tag selection MUST NOT rely on git tag creatordate.

#### Scenario: Tenant with no prior backup is pending

- **GIVEN** tenant "company12926-poc" has no backup tags matching the timestamp pattern
- **AND** no backup commit exists on the tenant branch for the current window
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

#### Scenario: Latest tag selected by name timestamp not creatordate

- **GIVEN** tenant "mediolanum" has tags `mediolanum/2026-07-22_21-54-46` and `mediolanum/2026-08-03_13-30-20`
- **AND** both tags share the same git creatordate due to branch squash
- **WHEN** the pending check runs at 14:00 UTC on 2026-08-03
- **AND** the tenant schedule is `"0 0 * * *"`
- **THEN** the system uses `2026-08-03_13-30-20` as the latest backup time
- **AND** the tenant is NOT considered pending

#### Scenario: Branch commit without matching tag is pending

- **GIVEN** tenant "acme-prod" has branch commit "backup: 2026-08-06" at 01:20 UTC
- **AND** no tag exists with embedded timestamp on or after 2026-08-06 00:00 UTC
- **WHEN** the pending check runs at 01:30 UTC on 2026-08-06
- **THEN** the tenant is considered pending with reason indicating missing tag
