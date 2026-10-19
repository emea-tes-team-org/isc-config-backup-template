# Tasks: Cleanup Backup Deployment Traces

## 1. Cleanup helper

- [x] 1.1 Create `scripts/cleanup-deployment.sh` (deactivate + delete latest deployment for one environment)
- [x] 1.2 Create `scripts/cleanup-deployments.mjs` (bulk sweep with `--environment` and `--dry-run`)
- [x] 1.3 Non-fatal failures via `::warning::` and exit 0

## 2. Backup workflows

- [x] 2.1 Add `deployments: write` to `backup.yml` and `scheduled-backup.yml`
- [x] 2.2 Add `Remove ephemeral deployment trace` step (`if: always()`, script from `main`)
- [x] 2.3 Scheduled matrix uses `matrix.environment`; manual backup uses tenant environment name

## 3. Historical sweep workflow

- [x] 3.1 Create `.github/workflows/cleanup-deployments.yml` with dry-run default
- [x] 3.2 Main-branch guard and step summary output

## 4. Tests

- [x] 4.1 Create `scripts/test-cleanup-deployment.mjs`
- [x] 4.2 Extend `scripts/test-workflow-references.mjs` for cleanup steps and permissions
- [x] 4.3 Run `node scripts/test-cleanup-deployment.mjs` and `node scripts/test-workflow-references.mjs`

## 5. Documentation

- [x] 5.1 README — Environments vs deployment history under Scheduled Backups
- [x] 5.2 CHANGELOG Unreleased entry

## 6. Validation

- [x] 6.1 `openspec validate 2026-08-12-cleanup-backup-deployment-traces --strict`
