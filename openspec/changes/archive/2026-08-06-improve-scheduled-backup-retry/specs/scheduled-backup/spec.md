## MODIFIED Requirements

### Requirement: Workflow concurrency control

The scheduled backup workflow SHALL use a concurrency group without cancel-in-progress so overlapping scheduled runs (including retry crons) complete rather than aborting in-progress matrix backups.

#### Scenario: Overlapping retry cron does not cancel in-progress run

- **GIVEN** a scheduled backup run is in progress at 01:00 UTC
- **WHEN** a retry cron triggers at 01:15 UTC for the same branch
- **THEN** the in-progress run continues to completion
- **AND** the 01:15 run executes its own prepare-matrix independently

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
