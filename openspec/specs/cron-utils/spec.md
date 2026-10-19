# cron-utils Specification

## Purpose
TBD - created by archiving change add-hostname-and-next-backup. Update Purpose after archive.
## Requirements
### Requirement: Shared cron expression utilities

The system SHALL expose a shared module at `scripts/cron-utils.mjs` that exports reusable helpers for working with standard 5-field cron expressions (minute hour day-of-month month day-of-week). Any script that needs to test, advance, or rewind cron time references SHALL import from this module rather than reimplementing the logic.

Feature: Cron utilities

#### Scenario: matchesCron returns true for an exact match
- **GIVEN** a cron expression `"0 6 * * *"` (daily at 06:00 UTC)
- **WHEN** `matchesCron("0 6 * * *", new Date("2026-06-20T06:00:00Z"))` is called
- **THEN** the function returns `true`

#### Scenario: matchesCron returns false for a non-matching minute
- **GIVEN** a cron expression `"0 6 * * *"` (daily at 06:00 UTC)
- **WHEN** `matchesCron("0 6 * * *", new Date("2026-06-20T06:01:00Z"))` is called
- **THEN** the function returns `false`

#### Scenario: matchesCron rejects malformed expressions
- **GIVEN** a cron expression with fewer than 5 fields
- **WHEN** `matchesCron` is called
- **THEN** the function exits the process with a non-zero status and prints an error message identifying the malformed expression

#### Scenario: nextCronTime walks forward to the next match
- **GIVEN** a cron expression `"0 6 * * *"` (daily at 06:00 UTC)
- **AND** a reference time `2026-06-20T07:30:00Z` (after the most recent 06:00 fire)
- **WHEN** `nextCronTime("0 6 * * *", new Date("2026-06-20T07:30:00Z"))` is called
- **THEN** the function returns a `Date` corresponding to `2026-06-21T06:00:00Z`

#### Scenario: nextCronTime walks across month boundaries
- **GIVEN** a cron expression `"0 6 1 * *"` (first day of each month at 06:00 UTC)
- **AND** a reference time `2026-06-20T07:30:00Z`
- **WHEN** `nextCronTime("0 6 1 * *", new Date("2026-06-20T07:30:00Z"))` is called
- **THEN** the function returns a `Date` corresponding to `2026-07-01T06:00:00Z`

#### Scenario: nextCronTime returns null when no match is found within the search window
- **GIVEN** a cron expression with a search window that cannot produce a match within 32 days of the reference time
- **WHEN** `nextCronTime` exhausts the search window
- **THEN** the function returns `null`

#### Scenario: previousCronTime walks back to the prior match
- **GIVEN** a cron expression `"0 6 * * *"` (daily at 06:00 UTC)
- **AND** a reference time `2026-06-20T07:30:00Z`
- **WHEN** `previousCronTime("0 6 * * *", new Date("2026-06-20T07:30:00Z"))` is called
- **THEN** the function returns a `Date` corresponding to `2026-06-20T06:00:00Z`

