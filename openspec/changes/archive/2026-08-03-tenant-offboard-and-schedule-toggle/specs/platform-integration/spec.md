## ADDED Requirements

### Requirement: Schedule toggle and offboard workflows on main

The system SHALL expose tenant schedule toggle and offboard as GitHub Actions workflows triggered via `workflow_dispatch` on the `main` branch.

#### Scenario: Schedule toggle workflow uses CLI in Actions

- **GIVEN** `.github/workflows/schedule-toggle.yml` executes
- **WHEN** the toggle step runs
- **THEN** it executes `node scripts/cli.mjs schedule-toggle <tenant-name>`
- **AND** pushes the updated `tenants.yaml` to `main`

#### Scenario: Offboard workflow uses CLI in Actions

- **GIVEN** `.github/workflows/offboard.yml` executes
- **WHEN** the offboard step runs
- **THEN** it executes `node scripts/cli.mjs offboard <tenant-name>`
- **AND** performs tag deletion and branch squash via the delegated script

## MODIFIED Requirements

### Requirement: Unified CLI mirrors GitHub Actions

The system SHALL expose equivalent functionality via `npm run cli` for every user-facing GitHub Actions workflow: onboard, backup, restore, verify, tokenize, schedule-toggle, and offboard.

#### Scenario: Local backup matches Action backup

- **GIVEN** a developer checks out tenant branch "acme-prod" with valid credentials in `.env`
- **WHEN** they run `npm run cli -- backup`
- **THEN** the same SP-Config export, download, and file layout steps execute as in `.github/workflows/backup.yml`

#### Scenario: CI uses environment secrets without .env

- **GIVEN** a GitHub Actions job with `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET` from the tenant Environment
- **WHEN** `node scripts/cli.mjs backup` runs
- **THEN** the CLI does not fail due to missing `.env`
- **AND** credentials come from the CI environment

#### Scenario: Schedule toggle matches Action toggle

- **GIVEN** tenant "acme-prod" has `active: true` in `tenants.yaml`
- **WHEN** the developer runs `npm run cli -- schedule-toggle acme-prod`
- **THEN** the same registry flip occurs as in `.github/workflows/schedule-toggle.yml`

#### Scenario: Offboard matches Action offboard

- **GIVEN** tenant "acme-prod" is registered and has backup tags
- **WHEN** the developer runs `npm run cli -- offboard acme-prod`
- **THEN** the same registry removal, tag deletion, and branch squash occur as in `.github/workflows/offboard.yml`
