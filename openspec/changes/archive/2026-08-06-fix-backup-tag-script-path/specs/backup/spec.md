## ADDED Requirements

### Requirement: Tag helper scripts restored from main after tenant checkout

After switching to a tenant branch for commit or tag steps, backup workflows SHALL restore tag helper scripts from the `main` branch before invoking `create-backup-tag.sh`. Restored scripts MUST include `create-backup-tag.sh`, `push-backup-tag.sh`, and `push-with-retry.sh` with their relative paths preserved.

#### Scenario: Manual backup creates tag after tenant branch checkout

- **GIVEN** manual ISC Backup completes for tenant "acme-prod"
- **AND** the job switched to branch "acme-prod" for commit
- **WHEN** the tag step runs
- **THEN** tag helper scripts are loaded from `main`
- **AND** restore-point tag "acme-prod/<timestamp>" is pushed successfully

#### Scenario: Tag step fails clearly when main scripts missing

- **GIVEN** tag helper scripts are not available on `main`
- **WHEN** the tag step attempts restore from `main`
- **THEN** the step exits with a non-zero code
- **AND** an error message identifies the missing script path

## MODIFIED Requirements

### Requirement: GitHub Actions backup workflow commits and tags

The ISC Backup workflow SHALL run the backup script, commit changes to the tenant branch if any, and push a UTC timestamp tag. The tag SHALL reference a dedicated commit whose root tree contains only the `backups/` directory (no `.tenant.yaml`, `.gitignore`, or other branch metadata). The tenant branch commit MAY include branch metadata; the tag commit MUST NOT. Before invoking the tag helper, the workflow SHALL restore tag scripts from `main` as required on tenant branches.

#### Scenario: Backup workflow uses tenant environment

- **GIVEN** backup is triggered for tenant "acme-prod"
- **WHEN** the workflow job runs
- **THEN** `environment: acme-prod` scopes secrets
- **AND** scripts are checked out from `main`
- **AND** backup data is read/written on branch "acme-prod"

#### Scenario: Push conflict recovery

- **GIVEN** the remote tenant branch moved during backup execution
- **WHEN** the initial push is rejected
- **THEN** the workflow fetches the latest remote tip, re-applies backup changes, and retries the push

#### Scenario: Tag commit contains only backups tree

- **GIVEN** backup completes for tenant "acme-prod" and tag "acme-prod/2026-08-05_12-00-00" is created
- **WHEN** the tagged commit tree is inspected
- **THEN** `backups/acme-prod/` is present at the tag ref
- **AND** `.tenant.yaml` is absent at the tag ref
- **AND** `.gitignore` is absent at the tag ref

#### Scenario: Tag commit differs from branch HEAD

- **GIVEN** tenant branch "acme-prod" HEAD includes `.tenant.yaml` and `backups/acme-prod/`
- **WHEN** the backup workflow creates tag "acme-prod/2026-08-05_12-00-00"
- **THEN** the tag commit SHA differs from branch HEAD SHA
- **AND** branch HEAD still contains `.tenant.yaml`
