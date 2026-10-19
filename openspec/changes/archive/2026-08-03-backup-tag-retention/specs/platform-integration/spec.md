## ADDED Requirements

### Requirement: Tag retention workflow on main

The system SHALL expose backup tag retention as a GitHub Actions workflow on the `main` branch, scheduled weekly and manually triggerable with an optional dry-run mode.

#### Scenario: Prune tags workflow invokes retention script

- **GIVEN** `.github/workflows/prune-tags.yml` executes
- **WHEN** the prune step runs
- **THEN** it executes `node scripts/prune-tags.mjs`
- **AND** passes `dry_run` from workflow inputs when triggered via `workflow_dispatch`

#### Scenario: Prune tags workflow uses write permissions

- **GIVEN** ISC Prune Tags runs to delete stale backup tags
- **WHEN** the workflow pushes tag deletion refspecs to origin
- **THEN** the job has `contents: write` permission
- **AND** uses `ADMIN_TOKEN` or `GITHUB_TOKEN` for authentication

#### Scenario: Prune tags workflow prevents concurrent runs

- **GIVEN** a scheduled prune run is in progress
- **WHEN** a manual `workflow_dispatch` prune is triggered
- **THEN** only one prune run executes at a time via a concurrency group
