## ADDED Requirements

### Requirement: Dashboard generated from scheduled summary job

When the scheduled backup matrix runs with at least one tenant, the summary job SHALL generate the backup dashboard and upload it as a workflow artifact.

#### Scenario: Dashboard artifact after scheduled backup
- **GIVEN** the scheduled backup matrix completed with at least one backup job
- **WHEN** the summary job runs
- **THEN** `scripts/generate-dashboard.mjs` produces dashboard markdown
- **AND** the dashboard is uploaded as a workflow artifact
- **AND** the dashboard content is appended to the GitHub Actions step summary

### Requirement: Manual dashboard dispatch preserved

The dashboard workflow SHALL remain available via manual `workflow_dispatch` for on-demand regeneration.

#### Scenario: Operator triggers dashboard manually
- **GIVEN** an operator runs the Backup Dashboard workflow manually
- **WHEN** the dashboard job completes
- **THEN** the dashboard artifact is produced
