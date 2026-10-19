## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Skip idle jobs when matrix is empty

When the prepare-matrix job determines zero pending tenants, the workflow SHALL skip backup and summary jobs.

#### Scenario: Empty matrix skips downstream jobs
- **GIVEN** no active tenants are pending in the current schedule window
- **WHEN** the prepare-matrix job completes with count 0
- **THEN** the backup job is not started
- **AND** the summary job is not started

### Requirement: Workflow concurrency control

The scheduled backup workflow SHALL use a concurrency group with cancel-in-progress so overlapping scheduled runs do not stack.

#### Scenario: Overlapping run cancelled
- **GIVEN** a scheduled backup run is in progress
- **WHEN** a new scheduled run starts for the same branch
- **THEN** the in-progress run is cancelled

### Requirement: Backup job timeout

Each matrix backup job SHALL have a timeout of 15 minutes.

#### Scenario: Hung backup fails fast
- **GIVEN** a backup job hangs during the ISC API export step
- **WHEN** 15 minutes elapse
- **THEN** the job fails with a timeout error

### Requirement: npm dependency cache

Backup jobs that run `npm ci` SHALL enable npm caching via `actions/setup-node` with `cache: 'npm'`.

#### Scenario: Cached install on repeat runs
- **GIVEN** a previous backup job populated the npm cache for the lockfile
- **WHEN** a subsequent backup job runs `npm ci`
- **THEN** setup-node restores dependencies from cache
