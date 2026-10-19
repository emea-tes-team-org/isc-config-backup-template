# Backup Statistics

## Purpose

Compute backup directory statistics for the `backups/` folder, reporting size, total file count, and git working-tree change counts as JSON.

## Requirements

### Requirement: Compute backup directory statistics

The backup statistics script SHALL output a JSON object containing the `size` in bytes, total `files` count, and the `added`, `deleted`, and `modified` counts derived from `git status --porcelain` for the `backups/` directory.

#### Scenario: Backups directory exists with changes
- **GIVEN** the `backups/` directory exists and contains files
- **AND** git status shows some added, deleted, and modified files under `backups/`
- **WHEN** the backup statistics script runs
- **THEN** it outputs valid JSON with `size`, `files`, `added`, `deleted`, and `modified` counts
- **AND** each count is a non-negative integer

#### Scenario: Backups directory is missing
- **GIVEN** the `backups/` directory does not exist
- **WHEN** the backup statistics script runs
- **THEN** it outputs `{"size":0,"files":0,"added":0,"deleted":0,"modified":0}`
- **AND** it exits successfully

#### Scenario: No git changes in backups directory
- **GIVEN** the `backups/` directory exists
- **AND** git status shows no changes under `backups/`
- **WHEN** the backup statistics script runs
- **THEN** the `added`, `deleted`, and `modified` fields are all `0`
