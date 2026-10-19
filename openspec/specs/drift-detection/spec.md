# Drift Detection

## Purpose

Compare live ISC tenant configuration against git backups to surface configuration drift.

## Requirements

### Requirement: Drift detection via GitHub Actions

The system SHALL provide a `workflow_dispatch` workflow that compares live ISC tenant configuration against the latest git backup for a named tenant.

#### Scenario: Detect drift for onboarded tenant

- **GIVEN** tenant "acme-prod" is registered in `tenants.yaml`
- **AND** branch "acme-prod" contains backup data under `backups/acme-prod/`
- **WHEN** an operator runs **Actions > Drift Detection** with tenant "acme-prod"
- **THEN** the workflow authenticates using the acme-prod GitHub Environment secrets
- **AND** reports configuration objects that differ between live ISC and the git backup

#### Scenario: Drift detection requires registered tenant

- **GIVEN** "unknown-tenant" is not listed in `tenants.yaml`
- **WHEN** an operator runs Drift Detection with tenant "unknown-tenant"
- **THEN** the workflow fails with a clear error before attempting ISC API calls
