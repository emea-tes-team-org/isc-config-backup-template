# Backup Operations

## Purpose

Foundational specification for exporting, storing, and scheduling ISC configuration backups in git. Covers SP-Config export, on-disk layout, commit/tag semantics, and the centralized scheduler on `main`.

Child capabilities: `backup`, `scheduled-backup`, `per-tenant-schedule`, `backup-pending-check`, `backup-stats`, `backup-file-statistics`, `schedule-aware-parser`, `cron-utils`.
## Requirements
### Requirement: SP-Config export of all exportable object types

The system SHALL authenticate with ISC, fetch all exportable configuration object types, create an SP-Config export job, poll until complete, and download every object to flat `backups/<TYPE>/<objectId>.json` on the tenant branch.

#### Scenario: Successful export and download

- **GIVEN** valid ISC credentials for tenant "acme-prod"
- **WHEN** `npm run cli -- backup` runs on the acme-prod branch
- **THEN** an export job is created via the SP-Config API
- **AND** each exportable object is written to `backups/<TYPE>/<objectId>.json`
- **AND** JSON files are canonicalized for stable git diffs

### Requirement: Backup artifacts organized by object type

Each configuration object SHALL be stored as `backups/<OBJECT_TYPE>/<objectId>.json` on the tenant branch containing the full export envelope (`self`, `object`, `version`, JWS fields).

#### Scenario: Workflow object stored by type and id

- **GIVEN** the export contains a WORKFLOW object with id "abc-123"
- **WHEN** the backup completes on branch "acme-prod"
- **THEN** file `backups/WORKFLOW/abc-123.json` exists
- **AND** the file content is pretty-printed JSON

### Requirement: Commit only when backup content changed

The backup workflow SHALL commit to the tenant branch only when at least one backup file has meaningful content change; noise-only field changes SHALL be skipped.

#### Scenario: Unchanged configuration skips commit

- **GIVEN** a tenant's ISC configuration is unchanged since the last backup
- **WHEN** the backup workflow runs successfully
- **THEN** no new commit is created on the tenant branch
- **AND** a timestamp tag is still pushed for audit reference

#### Scenario: Changed configuration creates commit

- **GIVEN** at least one configuration object changed in ISC
- **WHEN** the backup workflow runs successfully
- **THEN** a commit with message `backup: <date> ISC configuration snapshot` is pushed to the tenant branch

### Requirement: Timestamp tags on every backup run

Every successful backup run SHALL create a git tag named `<tenant>/<YYYY-MM-DD_HH-MM-SS>` in UTC pointing at the commit HEAD (new or existing).

#### Scenario: Tag created after backup

- **GIVEN** backup workflow completes for tenant "acme-prod"
- **WHEN** the commit step finishes
- **THEN** tag "acme-prod/2026-01-15_06-00-00" (example) exists on the remote
- **AND** the tag is usable as a restore source ref

### Requirement: Centralized schedule matrix on main

The system SHALL parse `tenants.yaml` on `main` every 15 minutes and dispatch per-tenant backup jobs only for active tenants whose cron schedule matches the current UTC window and whose backup is pending.

#### Scenario: Scheduled backup respects per-tenant cron

- **GIVEN** `tenants.yaml` contains a tenant with `active: true` and `schedule: "0 6 * * *"`
- **WHEN** the scheduled backup matrix runs at 06:00 UTC
- **THEN** a backup job is dispatched for that tenant
- **AND** no backup job is dispatched for that tenant at 05:45 UTC

#### Scenario: Manual single-tenant trigger bypasses schedule

- **GIVEN** tenant "acme-prod" is registered
- **WHEN** an operator runs **Actions > Scheduled ISC Backup Matrix** with tenant "acme-prod"
- **THEN** a backup job runs for "acme-prod" regardless of cron schedule or pending status

### Requirement: Backup uses scripts from main

GitHub Actions backup jobs SHALL always execute scripts from `main` while reading and writing backup data on the tenant branch.

#### Scenario: Scripts checked out from main during tenant backup

- **GIVEN** backup runs for tenant branch "acme-prod"
- **WHEN** the workflow executes
- **THEN** `scripts/` and `package.json` are checked out from `main`
- **AND** existing backup data is fetched from branch "acme-prod" before the export
- **AND** commits are pushed back to branch "acme-prod"

### Requirement: Deleted ISC objects removed from backup

When an object present in the previous backup is absent from the current export, the system SHALL delete the corresponding JSON file from the flat `backups/` directory.

#### Scenario: Removed workflow deleted from git backup

- **GIVEN** `backups/WORKFLOW/old-id.json` existed in the previous backup
- **AND** that workflow no longer exists in ISC
- **WHEN** a new backup completes
- **THEN** `backups/WORKFLOW/old-id.json` is removed from the working tree
- **AND** the deletion is included in the backup commit if other changes exist

### Requirement: Restore-point tag contains flat backups tree

Restore-point tags SHALL reference commits whose root tree contains only a flat `backups/` directory (`backups/<TYPE>/…`), not nested tenant subfolders.

#### Scenario: Tag archive download

- **GIVEN** tag `abb-poc/2026-08-12_00-00-00` is created after backup
- **WHEN** an operator downloads the tag tree
- **THEN** paths appear as `backups/ROLE/<id>.json`
- **AND** not `backups/abb-poc/ROLE/<id>.json`

