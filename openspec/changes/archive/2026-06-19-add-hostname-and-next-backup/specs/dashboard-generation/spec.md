## MODIFIED Requirements

### Requirement: Generate tenant overview table

The dashboard generator SHALL produce the Tenant Overview table with one row per tenant, where each column contains the tenant name, hostname reference, description, active indicator, last backup date, next scheduled backup time, object count, and derived status.

#### Scenario: Active tenant with backups
- **GIVEN** a tenant registry containing `company12926-poc` with `active: true` and `hostname: company12926-poc.identitynow-demo.com`
- **AND** `schedule: "0 6 * * *"`
- **AND** the tenant branch has a recent commit and JSON backup objects
- **WHEN** the dashboard generator produces the Tenant Overview table
- **THEN** the row contains the hostname, the active indicator, the commit date, the next backup time computed from the cron expression, the object count, and `Healthy` status
- **AND** each value appears in the correct column

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

### Requirement: Escape markdown table content

The dashboard generator SHALL escape any `|` characters that appear in tenant descriptions or hostnames so that the rendered markdown table remains valid.

#### Scenario: Description contains a pipe character
- **GIVEN** a tenant has a description containing the `|` character
- **WHEN** the dashboard generator renders the Tenant Overview table
- **THEN** the description is escaped so the markdown table remains valid
- **AND** the pipe character is visible in the rendered output

#### Scenario: Hostname contains a pipe character
- **GIVEN** a tenant has a hostname containing the `|` character
- **WHEN** the dashboard generator renders the Tenant Overview table
- **THEN** the hostname is escaped so the markdown table remains valid

### Requirement: List recent backup tags

The dashboard generator SHALL list backup tags in descending creation-date order, showing each tag name alongside the date of its tagged commit.

#### Scenario: Tags exist for multiple tenants
- **GIVEN** the git repository contains backup tags in the form `<tenant>/<YYYY-MM-DD_HH-MM-SS>`
- **WHEN** the dashboard generator produces the Recent Backup Tags section
- **THEN** the tags are listed in descending creation-date order
- **AND** each tag is shown with its commit date
