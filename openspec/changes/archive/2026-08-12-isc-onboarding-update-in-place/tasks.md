# Tasks: ISC Onboarding Update In Place

## 1. Shared onboarding logic

- [x] 1.1 Extend `onboard.mjs` to accept `GH_TOKEN` / `ADMIN_TOKEN` for GitHub API auth (prefer env token over `.local-pat` when set)
- [x] 1.2 Export or add workflow entry function that returns `{ created: boolean, updated: boolean }` for summary
- [x] 1.3 When remote branch exists: fetch and checkout branch, commit metadata only (do not recreate from main)
- [x] 1.4 Add unit tests for registry merge preserving `schedule`, `environment`, and tuning fields

## 2. Onboarding workflow refactor

- [x] 2.1 Remove "Check for duplicate tenant" step from `onboarding.yml`
- [x] 2.2 Replace bash branch/registry/secret steps with single Node onboarding invocation after credential validation
- [x] 2.3 Update workflow summary to show created vs updated
- [x] 2.4 Retain main-branch guard, ADMIN_TOKEN check, and credential validation steps

## 3. Tests

- [x] 3.1 Create or extend `scripts/test-onboard-upsert.mjs` for upsert detection and registry merge
- [x] 3.2 Extend `scripts/test-workflow-references.mjs` — assert duplicate check absent, onboard script step present
- [x] 3.3 Run `node scripts/test-onboard-upsert.mjs` and `node scripts/test-workflow-references.mjs`

## 4. Documentation

- [x] 4.1 Update README onboarding section — document re-onboard and secret refresh via same workflow
- [x] 4.2 Note offboard → re-onboard path no longer requires CLI

## 5. Changelog

- [x] 5.1 Add Unreleased changelog entry for idempotent onboarding workflow

## 6. Validation

- [x] 6.1 `openspec validate isc-onboarding-update-in-place --strict`
