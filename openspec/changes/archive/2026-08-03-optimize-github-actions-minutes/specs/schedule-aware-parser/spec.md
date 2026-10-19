## MODIFIED Requirements

### Requirement: Cron expression filtering at parse time

The tenant parser SHALL support filtering active tenants by matching their configured cron expression against the current UTC time. When building the latest-tag map for pending detection, the parser SHALL select the tag with the greatest **name-embedded timestamp** per tenant prefix, not git creatordate.

#### Scenario: Parser filters by schedule with exact cron match
- **GIVEN** two active tenants exist: "tenant-a" with schedule `"0 6 * * 1"` and "tenant-b" with schedule `"0 6 * * 2"`
- **AND** the current UTC time is Monday 06:00
- **WHEN** `node scripts/parse-tenants.mjs --active-only --check-schedule` executes
- **THEN** the output contains only "tenant-a"
- **AND** the JSON is valid GitHub Actions matrix format

#### Scenario: Parser counts only schedule-matching tenants
- **GIVEN** three active tenants exist with different schedules
- **AND** only one tenant's schedule matches the current UTC time
- **WHEN** `node scripts/parse-tenants.mjs --active-only --check-schedule --count` executes
- **THEN** the output is `1`

#### Scenario: Parser without --check-schedule returns all active tenants
- **GIVEN** active tenants with various schedules
- **WHEN** `node scripts/parse-tenants.mjs --active-only` executes without `--check-schedule`
- **THEN** all active tenants are returned regardless of schedule

#### Scenario: Tag map uses max embedded timestamp per tenant
- **GIVEN** tags `tenant-a/2026-07-01_00-00-00` and `tenant-a/2026-08-01_00-00-00` exist
- **AND** the July tag has a newer git creatordate than the August tag
- **WHEN** `node scripts/parse-tenants.mjs --active-only --check-pending` executes
- **THEN** the pending check uses `2026-08-01_00-00-00` as the latest backup for "tenant-a"
