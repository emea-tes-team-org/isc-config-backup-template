## ADDED Requirements

### Requirement: Term — Ephemeral Deployment Trace

An **Ephemeral Deployment Trace** SHALL mean the GitHub Deployment API record automatically created when a workflow job references `environment:`. Its status mirrors the job outcome (`success`, `failure`, etc.). Backup workflows SHALL delete this record after each job; it is not the backup audit trail.

#### Scenario: Deployment trace is not backup audit

- **GIVEN** a scheduled backup job for tenant "acme-prod" completes
- **WHEN** an operator needs the backup outcome
- **THEN** they consult Actions run history, git tags, branch commits, or `reports/backup-summary-*.md`
- **AND** not the Environments deployment history page

#### Scenario: Deployment trace distinct from GitHub Environment

- **GIVEN** tenant "acme-prod" has GitHub Environment "acme-prod"
- **WHEN** a backup job sets `environment: acme-prod`
- **THEN** GitHub injects secrets from the Environment
- **AND** GitHub also creates a Deployment record
- **AND** backup cleanup deletes the Deployment record but preserves the Environment

## MODIFIED Requirements

### Requirement: Term — GitHub Environment

A **GitHub Environment** SHALL mean a repository Environment named after the tenant (or an explicit `environment` override in `tenants.yaml`) that stores Environment-scoped secrets: `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET`. Environments are persistent. Deployment records created when jobs reference an environment are ephemeral and are removed by backup workflows.

#### Scenario: Environment scopes backup credentials

- **GIVEN** backup runs for tenant "acme-prod"
- **WHEN** the workflow job sets `environment: acme-prod`
- **THEN** secrets from the "acme-prod" Environment are injected

#### Scenario: Environment survives deployment cleanup

- **GIVEN** backup cleanup deleted the Deployment trace for "acme-prod"
- **WHEN** the next backup job runs for "acme-prod"
- **THEN** environment "acme-prod" still exists
- **AND** secrets are still injected
