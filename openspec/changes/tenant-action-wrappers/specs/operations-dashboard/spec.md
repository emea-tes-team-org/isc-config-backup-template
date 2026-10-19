## ADDED Requirements

### Requirement: Fleet table per-tenant action links

The generated fleet table SHALL include an Actions column with inline dispatch links for backup, schedule toggle, verify, and offboard per registered tenant.

#### Scenario: Fleet row lists all tenant actions

- **GIVEN** tenant "fernando" is listed in the generated fleet table
- **WHEN** an operator views the Tenant Overview table in README
- **THEN** the row for "fernando" includes dispatch links for Backup, Toggle, Verify, and Offboard
- **AND** each link targets a per-tenant wrapper workflow file for that action

#### Scenario: Action links use wrapper workflows not lifecycle mega-form

- **GIVEN** the generated README fleet table Actions column for tenant "fernando"
- **WHEN** an operator follows the Offboard link
- **THEN** the URL targets `isc-offboard-fernando.yml`
- **AND** the URL does not require selecting an operation in `isc-lifecycle.yml`

---

## MODIFIED Requirements

### Requirement: Workflow dispatch deep links

The operations dashboard SHALL include pre-built GitHub Actions dispatch URLs for common per-tenant operations (backup, schedule toggle, verify, offboard) embedded in the fleet table Actions column.

#### Scenario: Operator triggers backup from README

- **GIVEN** README fleet table lists tenant "fernando" with a Backup action link in the Actions column
- **WHEN** the operator follows the link and confirms the workflow run
- **THEN** ISC Backup runs for tenant "fernando" from `main`

#### Scenario: Operator triggers verify from fleet table

- **GIVEN** README fleet table lists tenant "fernando" with a Verify action link
- **WHEN** the operator follows the link and confirms the workflow run
- **THEN** tenant verification runs for "fernando" without additional tenant input

#### Scenario: Operator triggers offboard from fleet table

- **GIVEN** README fleet table lists tenant "fernando" with an Offboard action link
- **WHEN** the operator follows the link, types `offboard` in the confirm input, and runs the workflow
- **THEN** offboard executes for tenant "fernando"

---

## REMOVED Requirements

### Requirement: Separate per-tenant shortcuts table

**Reason**: Tenant action links are embedded in the fleet table Actions column, eliminating duplicate navigation.

**Migration**: Operators use the Actions column in Tenant Overview instead of the former Per-tenant shortcuts subsection below Quick Actions.
