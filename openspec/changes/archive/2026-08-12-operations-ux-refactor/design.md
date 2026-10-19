# Design: Operations UX Refactor

## Context

Grilling session 2026-08-12 established north star: GitHub Actions primary, CLI mirrors, `main` = app, tenant branches = data only, README = generated operations dashboard, flat `backups/` on tenant branches, six focused workflows.

Constraints:
- No deployment outside GitHub (no external hosting; committed/generated markdown on `main`)
- GitHub `workflow_dispatch` cannot conditionally show/hide inputs
- Small fleet (~6 tenants) enables big-bang flat backup migration

## Goals / Non-Goals

**Goals:**
- Operator self-service from README + 6 workflow cards
- Clear main vs tenant branch separation
- Flat backup paths aligned with Config Hub
- Specs consolidated to journey capabilities
- CLI ↔ Actions parity preserved

**Non-Goals:**
- Rename tenant branches to hostname-derived names
- Hosted web app or GitHub Pages (may follow later)
- Changing branch-per-tenant model or centralized scheduler (ADR-0002 stands)
- External Config Hub code changes

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ main                                                         │
│  scripts/  tenants.yaml  .github/workflows/ (6 files)      │
│  README.md (generated)  README.template.md  docs/          │
│  reports/                                                    │
└──────────────┬──────────────────────────────────────────────┘
               │ fetch / checkout data only
       ┌───────┴───────┐
       ▼               ▼
  fernando branch   andre branch  …
  ├── backups/          (flat TYPE/id.json)
  ├── .tenant.yaml
  ├── .gitignore
  ├── templates/  (optional)
  └── vars/       (optional)
```

### Workflow roster

| Workflow file | Display name | Trigger | Operations |
|---------------|--------------|---------|------------|
| `isc-lifecycle.yml` | ISC Lifecycle | dispatch | onboard, verify, schedule-toggle, offboard |
| `isc-backup.yml` | ISC Backup | dispatch | manual backup |
| `isc-restore.yml` | ISC Restore | dispatch | cross-tenant restore |
| `isc-config-tools.yml` | ISC Config Tools | dispatch | tokenize, drift-detection |
| `scheduled-backup.yml` | Scheduled Backup | cron + dispatch | fleet matrix |
| `isc-maintenance.yml` | ISC Maintenance | cron + dispatch | prune-tags, cleanup-deployments |

**ISC Lifecycle inputs:** `operation` (choice), `tenant`, onboard credential fields (api_url, client_id, client_secret, active, description), offboard `confirm_tenant`. Validation job fails fast when required fields missing for chosen operation.

**ISC Restore inputs:** `source_ref`, `target_tenant`, `restore_mode`, `vars_file`. Always runs on `main`. Resolves backup paths from flat `backups/` at source ref.

### README generation

- Source: `README.template.md` with static sections (license, links) + `{{OPS_DASHBOARD}}` placeholder
- Generator: extends `generate-dashboard.mjs` or new `generate-readme.mjs`
- Output: committed `README.md` on scheduled backup summary job
- Dashboard content: fleet table, per-tenant dispatch URLs, latest report link, architecture primer

Dispatch URL pattern:
```
https://github.com/{owner}/{repo}/actions/workflows/isc-backup.yml?query=tenant:fernando
```

### Flat backup path migration

**Evidence (Q19):** Initial commit `7510e71` used `BACKUP_DIR = join("backups", TENANT_NAME)` on single-branch `main`. Config Hub docs always specified `Backups Path: backups`. After branch-per-tenant (`e0052fc`), nested path was retained but is redundant when branch encodes tenant.

**Migration steps per tenant branch:**
1. `git mv backups/<tenant>/* backups/` (or script)
2. Update `.gitignore` to allow `backups/` not `backups/<tenant>/`
3. Update restore-point tags (re-tag or accept new tags going forward)
4. Update scripts: `BACKUP_DIR = "backups"` when on tenant branch context

**Path resolution helper:**
```javascript
function resolveBackupRoot(tenantName, gitRef?) {
  // On tenant branch working tree: "backups"
  // When reading via git cat-file at ref: "backups" at tenant branch refs
  // Legacy fallback removed after migration (big-bang)
}
```

### Delete workflow sync

Remove `sync-workflows.yml` and `openspec/specs/workflow-sync/spec.md` (archive). One-time workflow or script:
- For each tenant in registry: checkout branch, remove `.github/workflows/`, commit, push

### Spec consolidation map

| Journey spec | Merges from |
|--------------|-------------|
| `tenant-lifecycle` | isc-tenant-onboarding, tenant-offboard, tenant-schedule-toggle, onboarding-verification, tenant-lifecycle |
| `backup-operations` | backup, backup-operations, scheduled-backup, backup-tag-retention, backup-pending-check, per-tenant-schedule, schedule-aware-parser |
| `restore-operations` | restore, restore-operations |
| `tokenization` | tokenization (keep) |
| `observability` | dashboard-generation, reporting-observability, backup-summary-report, manual-backup-summary, backup-file-statistics, backup-stats, tenant-schedule-reporting, tenant-hostname-in-index, tenant-description-in-index |
| `platform-integration` | platform-integration, cli-alignment, workflow-sync (removed), cron-utils |

## Decisions

1. **Six workflows not one** — GitHub dispatch UI limitation; README deep-links mitigate sidebar friction.
2. **Big-bang flat backups** — small fleet; dual-read adds permanent complexity.
3. **README fully generated from template** — operator edits template; CI commits README.
4. **Restore from main only** — enables data-only tenant branches.
5. **Glossary update without fleet rename** — document `environment` override; defer branch renames.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Broken restore tags with old nested paths | Migration script + verify restore on each tenant post-migration |
| Operators bookmark old workflow URLs | README dispatch links + CHANGELOG breaking notice |
| Generated README merge conflicts | Only bot commits README; contributors edit template |
| Config Hub pointed at old nested path | Document tenant branch + `backups` path in `docs/setup.md` |

## Migration Plan

See `plan.md`. Sequence: sync kill → README hub → workflows → restore → flat path → specs.

## Open Questions

- Exact GitHub dispatch URL query syntax for pre-filled inputs (verify per workflow field names)
- Whether to squash tenant branch history during flat migration or additive commits only
