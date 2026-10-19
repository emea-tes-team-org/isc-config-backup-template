# ISC Backup

## Purpose

Core SP-Config backup capability: export ISC configuration objects to JSON files under `backups/<tenant>/`, invoked by GitHub Actions and CLI.
## Requirements
### Requirement: Authenticate with ISC OAuth client credentials

The backup script SHALL obtain an access token from the tenant's OAuth endpoint using `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET`.

#### Scenario: Successful authentication

- **GIVEN** valid credentials are configured for tenant "acme-prod"
- **WHEN** `scripts/backup.mjs` starts
- **THEN** authentication succeeds against `{TENANT_URL}/oauth/token`
- **AND** subsequent API calls use the bearer token

### Requirement: Export all exportable configuration types

The backup script SHALL query exportable object types and include all of them in a single SP-Config export job.

#### Scenario: All exportable types included

- **GIVEN** ISC reports exportable types including ROLE, SOURCE, and WORKFLOW
- **WHEN** the export job is created
- **THEN** all reported exportable types are included in `includeTypes`
- **AND** the export description includes the current date

### Requirement: Poll export job until complete

The backup script SHALL poll the export job status at 10-second intervals until complete or until the configured poll budget is exhausted. On retryable transient statuses (including `FAILED_EXTERNAL_COMMUNICATION`), the script SHALL create a new export job and poll again, up to a configurable maximum number of export attempts (default 3). The script SHALL fail on non-retryable terminal statuses (`FAILED`, `CANCELLED`) after retries are exhausted.

#### Scenario: Export completes within timeout

- **GIVEN** an export job is created
- **WHEN** the job status becomes COMPLETE
- **THEN** polling stops and download proceeds

#### Scenario: Export failure aborts backup

- **GIVEN** an export job status becomes FAILED with a non-retryable error
- **WHEN** polling detects the failure after all export attempts are exhausted
- **THEN** the script exits with a non-zero code and error details

#### Scenario: Transient communication failure retries export

- **GIVEN** an export job returns status `FAILED_EXTERNAL_COMMUNICATION` on every poll until attempt limit
- **AND** `maxExportAttempts` is 3
- **WHEN** the second export job reaches COMPLETE
- **THEN** polling stops and download proceeds
- **AND** the log records the retry count and previous job IDs

#### Scenario: Per-tenant poll budget override

- **GIVEN** tenant "axa" has `exportPollMinutes: 20` in tenants.yaml
- **WHEN** backup runs for "axa"
- **THEN** the poll budget allows up to 20 minutes before failing a single export attempt

### Requirement: Write canonicalized JSON per object

Each exported object SHALL be written to `backups/<tenant>/<TYPE>/<id>.json` with stable key ordering and normalized JWS fields for readable git diffs.

#### Scenario: Unchanged object not rewritten

- **GIVEN** an object's canonicalized content matches the existing file
- **WHEN** the export is processed
- **THEN** the file is not rewritten
- **AND** the object is counted as unchanged

#### Scenario: Noise-only changes skipped

- **GIVEN** an object's meaningful content is unchanged but noise fields differ
- **WHEN** the export is processed
- **THEN** the file is not rewritten
- **AND** the object is counted as noise-only

### Requirement: Remove deleted objects from backup tree

Objects present in the previous backup but absent from the current export SHALL have their JSON files deleted.

#### Scenario: Deleted object file removed

- **GIVEN** `backups/acme-prod/ROLE/old-id.json` existed previously
- **AND** that object is not in the current export
- **WHEN** download processing completes
- **THEN** `backups/acme-prod/ROLE/old-id.json` is deleted

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

### Requirement: Backup workflows publish GitHub Release with zip asset

The ISC Backup and Scheduled Backup workflows SHALL invoke the shared release helper after a restore-point tag is pushed. The helper SHALL create a GitHub Release with a zip asset containing only the `backups/` directory tree **only when** the new tag's `backups/` tree differs from the previous restore-point tag's `backups/` tree for the same tenant. When backup content is unchanged, the helper SHALL skip release creation and exit successfully without calling `gh release create`. The first restore-point tag for a tenant (no prior tag) SHALL still produce a release. Release API failures SHALL remain non-fatal.

#### Scenario: Manual backup with changes creates release

- **GIVEN** manual ISC Backup is triggered for tenant "acme-prod"
- **AND** the backup produces committed changes
- **AND** tag "acme-prod/2026-08-05_12-00-00" is pushed
- **AND** the previous restore-point tag "acme-prod/2026-08-04_12-00-00" has a different `backups/` tree
- **WHEN** the release step completes
- **THEN** a GitHub Release exists with tag "acme-prod/2026-08-05_12-00-00"
- **AND** the release includes a zip asset containing `backups/` JSON files
- **AND** the zip asset does not include `.tenant.yaml` or `.gitignore`

#### Scenario: Unchanged backup pushes tag but skips release

- **GIVEN** manual ISC Backup is triggered for tenant "acme-prod"
- **AND** the backup produces no committed changes
- **AND** tag "acme-prod/2026-08-05_12-15-00" is pushed for current HEAD
- **AND** the `backups/` tree at the new tag matches the previous restore-point tag
- **WHEN** the release step completes
- **THEN** no GitHub Release is created for "acme-prod/2026-08-05_12-15-00"
- **AND** the restore-point tag remains on the remote

#### Scenario: First restore-point tag creates release

- **GIVEN** manual ISC Backup is triggered for tenant "new-tenant"
- **AND** no prior restore-point tag exists for "new-tenant"
- **AND** tag "new-tenant/2026-08-05_12-00-00" is pushed
- **WHEN** the release step completes
- **THEN** a GitHub Release exists with tag "new-tenant/2026-08-05_12-00-00"

#### Scenario: Release failure is non-fatal

- **GIVEN** manual ISC Backup completes with a pushed tag whose backup content changed
- **AND** GitHub Release creation fails
- **WHEN** the workflow finishes
- **THEN** the workflow job does not fail solely because of release creation
- **AND** a warning annotation is emitted
- **AND** the tenant branch commit and backup tag remain on the remote

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

