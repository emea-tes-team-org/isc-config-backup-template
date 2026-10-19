# Tasks: Fix Backup Tag Script Path

## 1. Workflow tag step fix

- [x] 1.1 Add inline script-restore helper to `.github/workflows/backup.yml` tag step (temp dir + `git show main:scripts/...`)
- [x] 1.2 Apply same pattern to `.github/workflows/scheduled-backup.yml` (both unchanged and backed-up paths)
- [x] 1.3 Preserve sibling layout so `create-backup-tag.sh` can call `push-backup-tag.sh`

## 2. Tests

- [x] 2.1 Extend `scripts/test-workflow-references.mjs` to assert both workflows restore tag scripts from `main` before `create-backup-tag.sh`
- [x] 2.2 Run `node scripts/test-workflow-references.mjs`

## 3. Documentation

- [x] 3.1 Update README troubleshooting note: tenant branches lack scripts; tag step restores from main
- [x] 3.2 N/A — no API/connector docs affected

## 4. Changelog

- [x] 4.1 Add CHANGELOG entry under Unreleased for tag script path fix
- [x] 4.2 Confirm entry covers failed scheduled backup runs since 2026-08-05
