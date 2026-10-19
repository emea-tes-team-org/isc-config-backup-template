## ADDED Requirements

### Requirement: Matrix backup jobs remove ephemeral deployment traces

Each matrix backup job in `scheduled-backup.yml` SHALL run deployment cleanup for `matrix.environment` after all backup steps complete, regardless of job outcome. Cleanup SHALL restore `scripts/cleanup-deployment.sh` from `main` after the job switched to the tenant branch.

#### Scenario: Scheduled matrix job deletes deployment after success

- **GIVEN** scheduled backup matrix job completes for tenant "acme-prod"
- **AND** `matrix.environment` is "acme-prod"
- **AND** GitHub created a Deployment record for this job
- **WHEN** the cleanup step runs
- **THEN** the Deployment record is deleted

#### Scenario: Scheduled matrix job deletes deployment after failure

- **GIVEN** scheduled backup matrix job fails for tenant "acme-prod"
- **WHEN** the cleanup step runs with `if: always()`
- **THEN** the Deployment record for environment "acme-prod" is deleted
- **AND** other tenants' jobs proceed independently (`fail-fast: false`)

#### Scenario: Environment override uses correct environment name

- **GIVEN** tenant "fernando" has `environment: company12926-poc` in `tenants.yaml`
- **WHEN** the matrix backup job runs cleanup
- **THEN** cleanup targets environment "company12926-poc"
- **AND** does not query environment "fernando"

#### Scenario: Cleanup script restored from main on tenant branch

- **GIVEN** scheduled matrix job checked out tenant branch for commit
- **WHEN** the cleanup step runs
- **THEN** `scripts/cleanup-deployment.sh` is loaded from `main`
- **AND** cleanup executes without missing-script errors
