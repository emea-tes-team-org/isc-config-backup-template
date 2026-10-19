## ADDED Requirements

### Requirement: Manual backup removes ephemeral deployment trace

After all backup steps complete, the ISC Backup workflow (`backup.yml`) SHALL run deployment cleanup for the tenant environment, regardless of backup outcome. Cleanup SHALL restore `scripts/cleanup-deployment.sh` from `main` when the job checked out a tenant branch.

#### Scenario: Manual backup deletes deployment after success

- **GIVEN** manual ISC Backup completes successfully for tenant "acme-prod"
- **AND** environment "acme-prod" has a Deployment record from this job
- **WHEN** the cleanup step runs
- **THEN** the Deployment record is deleted
- **AND** the GitHub Environment "acme-prod" remains

#### Scenario: Manual backup deletes deployment after failure

- **GIVEN** manual ISC Backup fails before commit (e.g. ISC export error)
- **AND** environment "acme-prod" has a Deployment record with status `failure`
- **WHEN** the cleanup step runs with `if: always()`
- **THEN** the Deployment record is deleted

#### Scenario: Cleanup script restored from main on tenant branch

- **GIVEN** manual ISC Backup job switched to tenant branch "acme-prod" for commit
- **WHEN** the cleanup step runs
- **THEN** `scripts/cleanup-deployment.sh` is loaded from `main`
- **AND** cleanup executes without missing-script errors
