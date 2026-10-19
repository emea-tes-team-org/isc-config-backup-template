# Operations Dashboard

## ADDED Requirements

### Requirement: Generated README landing page

The system SHALL generate `README.md` from `README.template.md` by substituting an operations dashboard section containing fleet status, quick-action workflow dispatch links, latest report reference, and a concise architecture primer.

#### Scenario: Dashboard updated after scheduled backup

- **GIVEN** a scheduled backup run completes with at least one tenant processed
- **WHEN** the summary job runs on `main`
- **THEN** `README.md` is regenerated and committed to `main`
- **AND** the fleet table lists each registry tenant with active flag, last backup, and next scheduled run

#### Scenario: Template preserves static sections

- **GIVEN** `README.template.md` contains static content outside the dashboard placeholder
- **WHEN** generation runs
- **THEN** static sections are preserved verbatim in output
- **AND** only the dashboard placeholder is replaced

### Requirement: Workflow dispatch deep links

The operations dashboard SHALL include pre-built GitHub Actions dispatch URLs for common per-tenant operations (backup, schedule toggle, offboard).

#### Scenario: Operator triggers backup from README

- **GIVEN** README lists tenant "fernando" with a backup dispatch link
- **WHEN** the operator follows the link and confirms the workflow run
- **THEN** ISC Backup runs for tenant "fernando" from `main`

### Requirement: Technical documentation separation

Operator-facing landing content SHALL live in generated `README.md`. Detailed setup, CLI, tokenization, and restore documentation SHALL live under `docs/` and be linked from the template.

#### Scenario: Contributor finds CLI reference

- **GIVEN** an operator needs restore CLI syntax
- **WHEN** they follow the link from README to `docs/restore.md`
- **THEN** full restore documentation is available without cluttering the landing page
