## MODIFIED Requirements

### Requirement: Weekly tag retention per tenant prefix

The system SHALL retain exactly the 7 backup tags with the greatest name-embedded UTC timestamps per tenant prefix on the remote repository, and delete all other backup tags matching `<tenant>/YYYY-MM-DD_HH-MM-SS` for that prefix. When a backup tag is deleted, the system SHALL also delete the GitHub Release with the same tag name if one exists.

#### Scenario: Tenant with more than 7 tags is pruned to 7

- **GIVEN** tenant prefix "acme-prod" has backup tags from "acme-prod/2026-08-01_00-00-00" through "acme-prod/2026-08-10_00-00-00" (10 tags, one per day)
- **WHEN** tag retention runs for "acme-prod"
- **THEN** tags "acme-prod/2026-08-04_00-00-00" through "acme-prod/2026-08-10_00-00-00" remain on the remote
- **AND** tags "acme-prod/2026-08-01_00-00-00" through "acme-prod/2026-08-03_00-00-00" are deleted from the remote

#### Scenario: Tenant with 7 or fewer tags is unchanged

- **GIVEN** tenant prefix "acme-prod" has 5 backup tags matching the timestamp pattern
- **WHEN** tag retention runs for "acme-prod"
- **THEN** all 5 tags remain on the remote
- **AND** no tags are deleted

#### Scenario: Retention sorts by name-embedded timestamp not creatordate

- **GIVEN** tenant prefix "mediolanum" has tags "mediolanum/2026-07-01_00-00-00" and "mediolanum/2026-08-01_00-00-00"
- **AND** both tags share the same git creatordate
- **WHEN** tag retention evaluates which tags to keep among 8 total "mediolanum/*" backup tags
- **THEN** "mediolanum/2026-08-01_00-00-00" is ranked newer than "mediolanum/2026-07-01_00-00-00"
- **AND** the 7 tags with the greatest embedded timestamps are retained

#### Scenario: Malformed tags are skipped

- **GIVEN** remote tags include "acme-prod/latest" and "acme-prod/2026-08-01_00-00-00"
- **WHEN** tag retention runs
- **THEN** "acme-prod/latest" is not considered for deletion
- **AND** "acme-prod/2026-08-01_00-00-00" is not deleted when it is among the 7 newest valid backup tags

#### Scenario: Orphan prefix is pruned without registry entry

- **GIVEN** tenant prefix "old-tenant" has 10 backup tags on the remote
- **AND** "old-tenant" is not listed in `tenants.yaml`
- **WHEN** tag retention runs
- **THEN** the 7 newest "old-tenant/*" backup tags remain
- **AND** the 3 oldest are deleted

#### Scenario: Pruned backup tag release is deleted

- **GIVEN** tenant prefix "acme-prod" has 10 backup tags on the remote
- **AND** GitHub Releases exist for the 3 oldest backup tags being pruned
- **WHEN** tag retention runs
- **THEN** those 3 GitHub Releases are deleted from the repository
- **AND** GitHub Releases for the 7 retained backup tags remain

## MODIFIED Requirements

### Requirement: Tag retention via GitHub Actions

The system SHALL provide a GitHub Actions workflow named ISC Prune Tags that runs weekly on Sunday at 03:00 UTC and supports manual `workflow_dispatch`.

#### Scenario: Scheduled weekly prune runs on main

- **GIVEN** the ISC Prune Tags workflow is configured with cron `0 3 * * 0`
- **WHEN** the scheduled trigger fires on Sunday at 03:00 UTC
- **THEN** the workflow executes tag retention against the remote repository
- **AND** writes a step summary with kept and deleted tag counts per tenant prefix

#### Scenario: Manual prune deletes stale tags

- **GIVEN** tenant prefix "acme-prod" has 10 backup tags on the remote
- **WHEN** ISC Prune Tags runs via `workflow_dispatch`
- **THEN** exactly 3 tags are deleted from the remote for "acme-prod"
- **AND** exactly 7 tags remain

#### Scenario: Prune does not modify tenant branches or registry

- **GIVEN** tenant "acme-prod" exists in `tenants.yaml` with `active: true`
- **AND** tenant branch "acme-prod" has backup commits
- **WHEN** ISC Prune Tags completes
- **THEN** `tenants.yaml` on `main` is unchanged
- **AND** tenant branch "acme-prod" commits are unchanged
