## ADDED Requirements

### Requirement: Generate tenant overview table

The dashboard generator SHALL produce the Tenant Overview table with one row per tenant, where each column contains the tenant name, description, active indicator, last backup date, object count, and derived status.

Feature: Backup dashboard generation
Rule: The dashboard must render one markdown table row per tenant with correct columns and no cell overflow.

#### Scenario: Active tenant with backups
- **GIVEN** a tenant registry containing `company12926-poc` with `active: true`
- **AND** the tenant branch has a recent commit and JSON backup objects
- **WHEN** the dashboard generator produces the Tenant Overview table
- **THEN** the row contains `company12926-poc`, the active indicator, the commit date, the object count, and `Healthy` status
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

### Requirement: Escape markdown table content

The dashboard generator SHALL escape any `|` characters that appear in tenant descriptions so that the rendered markdown table remains valid.

Feature: Backup dashboard generation
Rule: Cell content that could break markdown table syntax must be escaped.

#### Scenario: Description contains a pipe character
- **GIVEN** a tenant has a description containing the `|` character
- **WHEN** the dashboard generator renders the Tenant Overview table
- **THEN** the description is escaped so the markdown table remains valid
- **AND** the pipe character is visible in the rendered output

### Requirement: List recent backup tags

The dashboard generator SHALL list backup tags in descending creation-date order, showing each tag name alongside the date of its tagged commit.

Feature: Backup dashboard generation
Rule: The dashboard must list the most recent backup tags with their dates.

#### Scenario: Tags exist for multiple tenants
- **GIVEN** the git repository contains backup tags in the form `<tenant>/<YYYY-MM-DD_HH-MM-SS>`
- **WHEN** the dashboard generator produces the Recent Backup Tags section
- **THEN** the tags are listed in descending creation-date order
- **AND** each tag is shown with its commit date

## MODIFIED Requirements

<!-- None — this is a new capability. -->

## REMOVED Requirements

<!-- None — this is a new capability. -->
