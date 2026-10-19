## ADDED Requirements

### Requirement: Backup jobs remove ephemeral deployment traces

When a backup workflow job references a tenant GitHub Environment via `environment:`, GitHub creates a Deployment record whose status mirrors the job outcome. After the backup job finishes (success or failure), the workflow SHALL deactivate and delete that Deployment record. The GitHub Environment and its secrets SHALL remain intact. Deployment cleanup failures SHALL be non-fatal.

#### Scenario: Successful scheduled backup removes deployment trace

- **GIVEN** scheduled backup completes successfully for tenant "acme-prod"
- **AND** GitHub created deployment ID 12345 for environment "acme-prod"
- **WHEN** the cleanup step runs
- **THEN** deployment 12345 is marked inactive
- **AND** deployment 12345 is deleted via the REST API
- **AND** environment "acme-prod" still exists with secrets unchanged

#### Scenario: Failed backup still removes deployment trace

- **GIVEN** scheduled backup fails for tenant "acme-prod" (e.g. missing `TENANT_URL`)
- **AND** GitHub created deployment ID 12345 with status `failure`
- **WHEN** the cleanup step runs with `if: always()`
- **THEN** deployment 12345 is deleted
- **AND** the backup job conclusion remains `failure` in Actions run history

#### Scenario: Cleanup failure is non-fatal

- **GIVEN** backup completes for tenant "acme-prod"
- **AND** deployment deletion API call fails
- **WHEN** the cleanup step finishes
- **THEN** the workflow job does not fail solely because of cleanup
- **AND** a warning annotation is emitted

#### Scenario: Backup workflows grant deployments write permission

- **GIVEN** `.github/workflows/scheduled-backup.yml` or `.github/workflows/backup.yml` runs
- **WHEN** the workflow permissions are inspected
- **THEN** `deployments: write` is declared
- **AND** cleanup can authenticate with `GITHUB_TOKEN`

### Requirement: Manual deployment history sweep workflow

The system SHALL expose a `workflow_dispatch` workflow on `main` that deletes historical Deployment records for one or all tenant environments. The workflow SHALL default to dry-run mode so operators must explicitly opt in to deletion.

#### Scenario: Dry run lists deployments without deleting

- **GIVEN** operator triggers deployment cleanup with `dry_run: true`
- **WHEN** the sweep workflow runs
- **THEN** matching deployment IDs are listed in the job summary
- **AND** no deployments are deleted

#### Scenario: Sweep deletes historical deployments

- **GIVEN** operator triggers deployment cleanup with `dry_run: false`
- **AND** environment "acme-prod" has stale deployment records
- **WHEN** the sweep workflow runs
- **THEN** each matching deployment is deactivated and deleted
- **AND** environment "acme-prod" and its secrets remain

## MODIFIED Requirements

### Requirement: GitHub Environments scope tenant secrets

Each tenant's ISC credentials SHALL be stored as Environment-scoped secrets (`TENANT_URL`, `CLIENT_ID`, `CLIENT_SECRET`) in a GitHub Environment named after the tenant, never as shared repository secrets. Backup workflows use Environments only for credential injection; Deployment records created as a side effect of `environment:` jobs are ephemeral and SHALL be removed after each backup job (see "Backup jobs remove ephemeral deployment traces").

#### Scenario: Backup job resolves tenant environment

- **GIVEN** backup runs for tenant "acme-prod"
- **WHEN** the backup job starts
- **THEN** `environment: acme-prod` is set on the job
- **AND** secrets are read from the "acme-prod" GitHub Environment

#### Scenario: Environment persists after deployment cleanup

- **GIVEN** backup job for tenant "acme-prod" completes
- **WHEN** deployment cleanup runs
- **THEN** environment "acme-prod" is not deleted
- **AND** secrets `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET` remain available for the next run
