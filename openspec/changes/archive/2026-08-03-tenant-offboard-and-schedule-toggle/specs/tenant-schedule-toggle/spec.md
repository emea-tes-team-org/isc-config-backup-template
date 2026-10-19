## ADDED Requirements

### Requirement: Schedule toggle via GitHub Actions

The system SHALL provide a `workflow_dispatch` workflow on `main` named ISC Schedule Toggle that accepts a single required input `tenant_name` and flips the tenant's `active` flag in `tenants.yaml`.

#### Scenario: Toggle removes active tenant from schedule

- **GIVEN** tenant "acme-prod" exists in `tenants.yaml` with `active: true`
- **WHEN** ISC Schedule Toggle runs on `main` with `tenant_name` = "acme-prod"
- **THEN** `tenants.yaml` on `main` is updated with `active: false` for "acme-prod"
- **AND** the change is committed and pushed to `main`
- **AND** the workflow reports that "acme-prod" was removed from the schedule

#### Scenario: Toggle adds inactive tenant to schedule

- **GIVEN** tenant "acme-prod" exists in `tenants.yaml` with `active: false`
- **WHEN** ISC Schedule Toggle runs on `main` with `tenant_name` = "acme-prod"
- **THEN** `tenants.yaml` on `main` is updated with `active: true` for "acme-prod"
- **AND** the scheduled backup matrix MAY include "acme-prod" on the next matching window

#### Scenario: Toggle assigns default schedule when re-enabling

- **GIVEN** tenant "acme-prod" exists in `tenants.yaml` with `active: false` and no `schedule` field
- **WHEN** ISC Schedule Toggle runs for "acme-prod"
- **THEN** the tenant entry includes `schedule: "0 0 * * *"`
- **AND** `active: true`

#### Scenario: Toggle rejects unknown tenant

- **GIVEN** "unknown-tenant" is not listed in `tenants.yaml`
- **WHEN** ISC Schedule Toggle runs with `tenant_name` = "unknown-tenant"
- **THEN** the workflow fails before modifying `tenants.yaml`
- **AND** a clear error message indicates the tenant was not found

#### Scenario: Schedule toggle runs on main only

- **GIVEN** the Schedule Toggle workflow is triggered on a branch that is not `main`
- **WHEN** the workflow starts
- **THEN** it fails immediately with a message indicating it must be run from `main`

### Requirement: Schedule toggle preserves branch and tags

The Schedule Toggle action SHALL NOT modify the tenant git branch, backup commits, backup tags, or GitHub Environment.

#### Scenario: Tags remain after toggle off

- **GIVEN** tenant "acme-prod" has backup tags "acme-prod/2026-08-01_06-00-00" and "acme-prod/2026-08-02_06-00-00"
- **WHEN** Schedule Toggle sets `active: false` for "acme-prod"
- **THEN** all existing "acme-prod/*" tags remain in the repository

#### Scenario: Branch history remains after toggle off

- **GIVEN** tenant branch "acme-prod" has multiple backup commits
- **WHEN** Schedule Toggle sets `active: false` for "acme-prod"
- **THEN** the tenant branch and its commit history are unchanged

### Requirement: Schedule toggle CLI parity

The system SHALL expose schedule toggle via `node scripts/cli.mjs schedule-toggle <tenant-name>` with the same flip semantics as the GitHub Actions workflow.

#### Scenario: CLI toggles active flag locally

- **GIVEN** tenant "acme-prod" has `active: true` in local `tenants.yaml`
- **WHEN** the developer runs `npm run cli -- schedule-toggle acme-prod`
- **THEN** local `tenants.yaml` is updated with `active: false` for "acme-prod"
- **AND** the command exits with code 0
