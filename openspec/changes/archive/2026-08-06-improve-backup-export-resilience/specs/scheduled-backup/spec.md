## MODIFIED Requirements

### Requirement: Backup job timeout

Each matrix backup job SHALL have a timeout derived from the tenant registry entry, defaulting to 15 minutes when `jobTimeoutMinutes` is not set.

#### Scenario: Hung backup fails fast

- **GIVEN** a backup job hangs during the ISC API export step
- **AND** the tenant has no timeout override
- **WHEN** 15 minutes elapse
- **THEN** the job fails with a timeout error

#### Scenario: Per-tenant timeout override

- **GIVEN** tenant "axa" has `jobTimeoutMinutes: 25` in tenants.yaml
- **WHEN** a scheduled matrix backup job runs for "axa"
- **THEN** the job timeout is 25 minutes
