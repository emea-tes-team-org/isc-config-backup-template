# Scheduled Backup

## Purpose

Centralized backup scheduler on `main` that parses `tenants.yaml`, builds a matrix of pending tenants, and dispatches parallel backup jobs.
## Requirements
### Requirement: Matrix scheduler runs every 15 minutes

The scheduled backup workflow SHALL run on explicit cron entries covering the union of active tenant schedule windows plus a one-hour retry band, instead of polling every 15 minutes. For a fleet where all tenants use `"0 0 * * *"`, the workflow SHALL trigger at most 8 times per day.

#### Scenario: Cron trigger parses tenants with schedule and pending filters
- **GIVEN** the workflow is triggered by schedule at 00:00 UTC
- **WHEN** the prepare-matrix job runs
- **THEN** `scripts/parse-tenants.mjs --active-only --check-schedule --check-pending` determines the backup matrix

#### Scenario: Cron trigger parses tenants
- **GIVEN** the workflow is triggered by schedule at 06:00 UTC
- **WHEN** the prepare-matrix job runs
- **THEN** `scripts/parse-tenants.mjs --active-only --check-schedule --check-pending` determines the backup matrix

#### Scenario: No trigger outside schedule windows
- **GIVEN** all active tenants have schedule `"0 0 * * *"`
- **AND** the current time is 14:00 UTC
- **WHEN** the workflow cron fires
- **THEN** no cron entry matches and the workflow does not run

### Requirement: Per-tenant cron schedule in registry

Each tenant entry in `tenants.yaml` MAY include a `schedule` field (5-field cron). Missing schedule SHALL be treated as always-matching (daily default).

#### Scenario: Tenant with schedule runs at matching time

- **GIVEN** tenant "acme-prod" has `schedule: "0 6 * * *"` and `active: true`
- **WHEN** the matrix runs at 06:00 UTC and the tenant is pending
- **THEN** "acme-prod" is included in the matrix

#### Scenario: Inactive tenant excluded

- **GIVEN** tenant "acme-dev" has `active: false`
- **WHEN** the matrix runs at any time
- **THEN** "acme-dev" is not included in the matrix

### Requirement: Pending check prevents duplicate daily backups

The matrix SHALL include only tenants whose backup is pending for the current schedule window. A tenant SHALL be considered pending when its latest restore-point tag is before the window scheduled time, OR when no tag exists for the window but a backup commit on the tenant branch exists for the current UTC day after the scheduled time (tag retry without mandatory re-export).

#### Scenario: Already backed up tenant excluded

- **GIVEN** tenant "acme-prod" has backup tag "acme-prod/2026-01-15_06-00-00"
- **AND** schedule is `"0 6 * * *"`
- **WHEN** the matrix runs at 06:15 UTC on 2026-01-15
- **THEN** "acme-prod" is not included in the matrix

#### Scenario: Branch commit without tag remains pending

- **GIVEN** tenant "acme-prod" has a branch commit "backup: 2026-08-06" at 01:20 UTC
- **AND** no restore-point tag exists with timestamp on or after 2026-08-06 00:00 UTC
- **AND** schedule is `"0 0 * * *"`
- **WHEN** the matrix runs at 01:30 UTC on 2026-08-06 within the retry window
- **THEN** "acme-prod" is included in the matrix

### Requirement: Parallel backup jobs with fail-fast disabled

The matrix strategy SHALL run backup jobs in parallel with `fail-fast: false` so one tenant failure does not abort others.

#### Scenario: One tenant failure does not stop others

- **GIVEN** the matrix includes tenants "acme-prod" and "acme-dev"
- **WHEN** "acme-prod" backup fails but "acme-dev" succeeds
- **THEN** "acme-dev" backup completes
- **AND** the workflow reports both results independently

### Requirement: Manual single-tenant dispatch

Workflow dispatch with a `tenant` input SHALL bypass schedule and pending checks and run backup for that tenant only.

#### Scenario: Manual trigger for one tenant

- **GIVEN** tenant "acme-prod" is registered
- **WHEN** an operator runs Scheduled ISC Backup Matrix with tenant "acme-prod"
- **THEN** exactly one backup job runs for "acme-prod"
- **AND** schedule and pending logic is bypassed

### Requirement: Matrix output includes tenant, branch, and environment

Each matrix entry SHALL include `tenant`, `branch`, and `environment` fields consumed by the backup job, all derived from the tenant name unless overridden.

#### Scenario: Matrix entry shape

- **GIVEN** tenant "acme-prod" is active and pending
- **WHEN** parse-tenants produces the matrix
- **THEN** the entry includes `{ tenant: "acme-prod", branch: "acme-prod", environment: "acme-prod" }`

### Requirement: Summary report after matrix completion

After all matrix jobs complete with count greater than zero, the workflow SHALL generate a backup summary report committed to `reports/`.

#### Scenario: Report generated after matrix run
- **GIVEN** the matrix backup jobs have all completed
- **AND** the matrix count was greater than zero
- **WHEN** the report generation step runs
- **THEN** a summary markdown file is created under `reports/`
- **AND** the file is committed to `main`

#### Scenario: No report when matrix empty
- **GIVEN** the prepare-matrix job completed with count 0
- **WHEN** the workflow finishes
- **THEN** no summary report is generated or committed

### Requirement: Skip idle jobs when matrix is empty

When the prepare-matrix job determines zero pending tenants, the workflow SHALL skip backup and summary jobs.

#### Scenario: Empty matrix skips downstream jobs
- **GIVEN** no active tenants are pending in the current schedule window
- **WHEN** the prepare-matrix job completes with count 0
- **THEN** the backup job is not started
- **AND** the summary job is not started

### Requirement: Workflow concurrency control

The scheduled backup workflow SHALL use a concurrency group without cancel-in-progress so overlapping scheduled runs (including retry crons) complete rather than aborting in-progress matrix backups.

#### Scenario: Overlapping retry cron does not cancel in-progress run

- **GIVEN** a scheduled backup run is in progress at 01:00 UTC
- **WHEN** a retry cron triggers at 01:15 UTC for the same branch
- **THEN** the in-progress run continues to completion
- **AND** the 01:15 run executes its own prepare-matrix independently

### Requirement: Backup job timeout

Each matrix backup job SHALL have a timeout derived from the tenant registry entry, defaulting to 15 minutes when `jobTimeoutMinutes` is not set.

#### Scenario: Hung backup fails fast

- **GIVEN** a backup job hangs during the ISC API export step
- **AND** the tenant has no timeout override
- **WHEN** 15 minutes elapse
- **THEN** the job fails with a timeout error

#### Scenario: Per-tenant timeout override

- **GIVEN** tenant "axa" has `jobTimeoutMinutes: 25` in tenants.yaml
- **WHEN** a scheduled matrix backup job runs for "axa"
- **THEN** the job timeout is 25 minutes

### Requirement: npm dependency cache

Backup jobs that run `npm ci` SHALL enable npm caching via `actions/setup-node` with `cache: 'npm'`.

#### Scenario: Cached install on repeat runs
- **GIVEN** a previous backup job populated the npm cache for the lockfile
- **WHEN** a subsequent backup job runs `npm ci`
- **THEN** setup-node restores dependencies from cache

### Requirement: Scheduled backup tags reference backups-only commits

When the scheduled backup matrix creates a restore-point tag (after a new branch commit or when tagging unchanged HEAD), the tag SHALL reference a commit whose root tree contains only the `backups/` directory, using the same semantics as the ISC Backup workflow. Before invoking the tag helper, the matrix backup job SHALL restore tag scripts from `main` after switching to the tenant branch.

#### Scenario: Scheduled tag after successful backup commit

- **GIVEN** scheduled backup completes with changes for tenant "acme-prod"
- **AND** tag "acme-prod/2026-08-05_00-00-00" is pushed
- **WHEN** the tagged commit tree is inspected
- **THEN** `backups/acme-prod/` is present at the tag ref
- **AND** `.tenant.yaml` is absent at the tag ref

#### Scenario: Scheduled tag on unchanged backup

- **GIVEN** scheduled backup finds no changes for tenant "acme-prod"
- **AND** the workflow tags current HEAD without a new branch commit
- **WHEN** tag "acme-prod/2026-08-05_00-15-00" is pushed
- **THEN** the tag commit tree contains only `backups/`
- **AND** `.gitignore` is absent at the tag ref

#### Scenario: Restore from scheduled backup tag

- **GIVEN** tag "acme-prod/2026-08-05_00-00-00" was created by scheduled backup
- **WHEN** restore reads `backups/acme-prod/ROLE/example.json` at that tag
- **THEN** the object file content is returned successfully

#### Scenario: Matrix backup restores tag scripts from main

- **GIVEN** scheduled matrix backup job for tenant "acme-prod"
- **AND** the job checked out tenant branch "acme-prod" for commit
- **WHEN** the tag step executes
- **THEN** tag helper scripts are loaded from `main`
- **AND** the restore-point tag is pushed without "No such file or directory" errors

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

### Requirement: Scheduled backup publishes GitHub Release with zip asset

Each scheduled matrix backup job SHALL invoke the shared release helper after a restore-point tag is pushed. The helper SHALL create a GitHub Release with a zip asset **only when** the new tag's `backups/` tree differs from the previous restore-point tag's `backups/` tree for the same tenant. When backup content is unchanged, the helper SHALL skip release creation and exit successfully. The helper SHALL be restored from `main` after the job switched to the tenant branch. Release API failures SHALL be non-fatal.

#### Scenario: Scheduled backup with changes creates release

- **GIVEN** scheduled backup completes with changes for tenant "abb-poc"
- **AND** tag "abb-poc/2026-08-13_00-57-38" is pushed
- **AND** the `backups/` tree differs from the previous restore-point tag for "abb-poc"
- **WHEN** the release step completes
- **THEN** a GitHub Release exists with tag "abb-poc/2026-08-13_00-57-38"
- **AND** the release includes a zip asset containing `backups/` JSON files

#### Scenario: Scheduled unchanged backup pushes tag but skips release

- **GIVEN** scheduled backup finds no changes for tenant "fernando"
- **AND** tag "fernando/2026-08-13_00-57-46" is pushed for current HEAD
- **AND** the `backups/` tree at the new tag matches the previous restore-point tag
- **WHEN** the release step completes
- **THEN** no GitHub Release is created for "fernando/2026-08-13_00-57-46"
- **AND** the restore-point tag remains on the remote

#### Scenario: Scheduled release failure is non-fatal

- **GIVEN** scheduled backup completes with a pushed tag whose backup content changed
- **AND** GitHub Release creation fails
- **WHEN** the matrix job finishes
- **THEN** the backup job does not fail solely because of release creation
- **AND** a warning annotation is emitted
- **AND** the tenant branch commit and backup tag remain on the remote

