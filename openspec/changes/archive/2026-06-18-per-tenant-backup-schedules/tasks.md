## 1. Extend tenants.yaml format and parser

- [x] 1.1 Add optional `schedule` field parsing to `scripts/parse-tenants.mjs` (recognize `schedule:` in YAML, store as string on tenant object)
- [x] 1.2 Implement `--check-schedule` flag in `scripts/parse-tenants.mjs` using a lightweight cron matcher (e.g. `node-cron` or simple regex split)
- [x] 1.3 Handle missing `schedule` as always-matching (daily default) when `--check-schedule` is used
- [x] 1.4 Add unit tests or manual verification for parser with sample `tenants.yaml` containing schedules

## 2. Update scheduled-backup.yml workflow

- [x] 2.1 Change workflow `schedule` trigger from daily `0 6 * * *` to every 15 minutes: `*/15 * * * *`
- [x] 2.2 Update `prepare-matrix` job to pass `--check-schedule` only when triggered by `schedule` event (skip for `workflow_dispatch`)
- [x] 2.3 Ensure manual dispatch with specific `inputs.tenant` still bypasses all filtering
- [x] 2.4 Update job name and echo to indicate "scheduled tenants" vs "all active tenants"

## 3. Enhance backup summary reporting

- [x] 3.1 Pass tenant schedule information from `prepare-matrix` to `backup` job outputs
- [x] 3.2 Add "Schedule" column to Backup Summary markdown table
- [x] 3.3 Include skipped tenants (filtered by schedule) in the summary with status `skipped`
- [x] 3.4 Update `reports/backup-summary-*.md` generation to persist schedule column

## 4. Documentation and rollout

- [x] 4.1 Update `tenants.yaml` comments to document the optional `schedule` field format
- [x] 4.2 Add example schedule entries to `tenants.yaml` for existing tenants (stagger across hours)
- [x] 4.3 Run `openspec validate per-tenant-backup-schedules --type change --strict` before archive
- [x] 4.4 Archive change with `openspec archive per-tenant-backup-schedules`
