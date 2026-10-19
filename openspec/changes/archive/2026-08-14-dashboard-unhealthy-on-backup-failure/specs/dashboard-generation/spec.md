## MODIFIED Requirements

### Requirement: Generate tenant overview table

The dashboard generator SHALL produce the Tenant Overview table with one row per tenant, where each column contains the tenant name, hostname reference, description, active indicator, last backup date, next scheduled backup time, object count, and derived status.

#### Scenario: Active tenant with backups

- **GIVEN** a tenant registry containing `company12926-poc` with `active: true` and `hostname: company12926-poc.identitynow-demo.com`
- **AND** `schedule: "0 6 * * *"`
- **AND** the tenant branch has a recent commit and JSON backup objects
- **AND** the latest backup attempt status for the tenant is `backed-up` or `unchanged`
- **WHEN** the dashboard generator produces the Tenant Overview table
- **THEN** the row contains the hostname, the active indicator, the latest restore-point tag date, the next backup time computed from the cron expression, the object count, and `Healthy` status
- **AND** each value appears in the correct column

#### Scenario: Active tenant with failed latest backup attempt

- **GIVEN** a tenant registry containing `ksb` with `active: true`
- **AND** the tenant branch has JSON backup objects and a latest restore-point tag dated `2026-08-13`
- **AND** the latest backup attempt status for the tenant is `failed`
- **WHEN** the dashboard generator produces the Tenant Overview table
- **THEN** the Last column shows `2026-08-13`
- **AND** the State column shows `⚠️ Backup failed`
- **AND** the State column does not show `Healthy`

#### Scenario: Last column uses restore-point tag date

- **GIVEN** a tenant registry containing `abb-poc` with `active: true`
- **AND** the tenant branch has a `backup:` commit dated `2026-08-12`
- **AND** the latest restore-point tag is `abb-poc/2026-08-13_00-57-38`
- **WHEN** the dashboard generator produces the Tenant Overview table
- **THEN** the Last column shows `2026-08-13`
- **AND** Last does not stay on the older backup commit date

#### Scenario: Active tenant without backups

- **GIVEN** a tenant registry containing `company12926-poc` with `active: true`
- **AND** the tenant branch has no backup objects
- **WHEN** the dashboard generator produces the Tenant Overview table
- **THEN** the row shows object count `0` and status `⚠️ Empty backup`

#### Scenario: Inactive tenant

- **GIVEN** a tenant registry containing `company12926-poc` with `active: false`
- **WHEN** the dashboard generator produces the Tenant Overview table
- **THEN** the active column shows the inactive indicator

#### Scenario: Next Backup column for a daily-default tenant

- **GIVEN** a tenant registry containing `axa` with `active: true` and no `schedule` field
- **WHEN** the dashboard generator produces the Tenant Overview table
- **THEN** the Next Backup column shows the literal text `daily`

#### Scenario: Next Backup column for a tenant with a schedule

- **GIVEN** a tenant registry containing `company12926-poc` with `schedule: "0 6 * * *"`
- **WHEN** the dashboard generator produces the Tenant Overview table at run time `2026-06-19T12:00:00Z`
- **THEN** the Next Backup column shows the next cron match time formatted as `YYYY-MM-DD HH:MM UTC` (e.g. `2026-06-20 06:00 UTC`)

### Requirement: Dashboard reflects latest backup attempt status

The dashboard generator SHALL accept optional per-tenant backup attempt statuses (`failed`, `backed-up`, `unchanged`) and use them when deriving the State column. When attempt status is `failed`, the tenant SHALL be reported as not healthy regardless of existing restore-point tags or object count.

#### Scenario: Successful unchanged attempt remains healthy

- **GIVEN** tenant `fernando` with object count greater than zero
- **AND** latest backup attempt status is `unchanged`
- **WHEN** the dashboard generator produces the Tenant Overview table
- **THEN** the State column shows `Healthy`

#### Scenario: No attempt status available falls back to git metadata

- **GIVEN** tenant `andre` with object count greater than zero and a last backup date
- **AND** no backup attempt status is supplied for `andre`
- **WHEN** the dashboard generator produces the Tenant Overview table
- **THEN** the State column shows `Healthy`
