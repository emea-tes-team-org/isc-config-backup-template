# Tasks: Improve Backup Export Resilience

## 1. Registry schema

- [x] 1.1 Add optional `exportPollMinutes` and `jobTimeoutMinutes` to tenant registry loader with defaults
- [x] 1.2 Include `jobTimeoutMinutes` in parse-tenants matrix output
- [x] 1.3 Document fields in README / tenants.yaml example

## 2. Backup script

- [x] 2.1 Refactor `pollExport` to accept poll budget from env/config
- [x] 2.2 Add export retry loop on `FAILED_EXTERNAL_COMMUNICATION` (default 3 attempts)
- [x] 2.3 Pass `exportPollMinutes` from workflow env (`TENANT_NAME` lookup or explicit env var)

## 3. Workflows

- [x] 3.1 Use `timeout-minutes: ${{ matrix.jobTimeoutMinutes || 15 }}` in scheduled-backup matrix job
- [x] 3.2 Pass export poll env to backup step in both workflows
- [x] 3.3 Add `axa` overrides in `tenants.yaml` after tuning values validated

## 4. Tests

- [x] 4.1 Unit test export retry logic (mock status sequence)
- [x] 4.2 Test parse-tenants includes timeout fields
- [x] 4.3 Run full relevant test suite

## 5. Documentation

- [x] 5.1 README: per-tenant timeout overrides and when to use them
- [x] 5.2 N/A — no API/connector docs affected

## 6. Changelog

- [x] 6.1 Add CHANGELOG entry for export retry and per-tenant timeouts
- [x] 6.2 Confirm entry mentions axa operational guidance
