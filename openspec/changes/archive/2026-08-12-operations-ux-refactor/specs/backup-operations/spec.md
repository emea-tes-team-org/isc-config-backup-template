# Backup Operations — Delta

## MODIFIED Requirements

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

### Requirement: Deleted ISC objects removed from backup

When an object present in the previous backup is absent from the current export, the system SHALL delete the corresponding JSON file from the flat `backups/` directory.

#### Scenario: Removed workflow deleted from git backup

- **GIVEN** `backups/WORKFLOW/old-id.json` existed in the previous backup
- **AND** that workflow no longer exists in ISC
- **WHEN** a new backup completes
- **THEN** `backups/WORKFLOW/old-id.json` is removed from the working tree
- **AND** the deletion is included in the backup commit if other changes exist

## ADDED Requirements

### Requirement: Restore-point tag contains flat backups tree

Restore-point tags SHALL reference commits whose root tree contains only a flat `backups/` directory (`backups/<TYPE>/…`), not nested tenant subfolders.

#### Scenario: Tag archive download

- **GIVEN** tag `abb-poc/2026-08-12_00-00-00` is created after backup
- **WHEN** an operator downloads the tag tree
- **THEN** paths appear as `backups/ROLE/<id>.json`
- **AND** not `backups/abb-poc/ROLE/<id>.json`
