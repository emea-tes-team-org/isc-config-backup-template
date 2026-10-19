# Architecture

## Branch-per-tenant model

This repository uses a **branch-per-tenant** model where the **tenant name** is the
single source of truth. It determines:

- The Git branch (`company21280-poc`)
- The GitHub Environment (`company21280-poc`)
- The backup folder (`backups/` on the tenant branch — flat layout, no tenant subdirectory)

Each tenant branch carries its own `.tenant.yaml` descriptor (name, description, active,
url reference) and a branch-specific `.gitignore` that isolates backup content.
A lightweight `tenants.yaml` on `main` indexes all tenants and tracks which ones receive daily
automated backups.

```
main
├── scripts/  tenants.yaml  .github/workflows/ (6 files)
├── README.md (generated)  README.template.md  docs/
└── reports/

fernando branch (example)
├── backups/ROLE/<id>.json  …  (flat TYPE/id layout)
├── .tenant.yaml
├── .gitignore
├── templates/  (optional)
└── vars/       (optional)
```

## Backup workflow

The backup workflow:

1. Authenticates with your ISC tenant using OAuth client credentials
2. Fetches all exportable configuration object types
3. Creates an SP-Config export (backup) of all objects
4. Downloads every object from the backup, organized by type under `backups/<TYPE>/`
5. Commits changes to the tenant's branch (only if objects changed)
6. Tags the commit with a timestamp for easy reference
7. Deletes old backups from SailPoint to keep the tenant tidy

## Backup structure

```
backups/
  ACCESS_PROFILE/
    {objectId}.json
  ROLE/
    {objectId}.json
  SOURCE/
    {objectId}.json
  WORKFLOW/
    {objectId}.json
  ...
```

Each `.json` file contains the decoded, pretty-printed configuration object.

## Tracking drift

Since every backup is committed to git, you can use standard git tools to track changes:

```bash
# See what changed in the last backup
git log --oneline -5

# Diff a specific object over time
git log -p backups/WORKFLOW/{objectId}.json
```

Use **ISC Config Tools** (`operation: drift-detection`) to compare live ISC state against the last committed backup without writing changes.

## Tenant registry

The `tenants.yaml` file at the repository root is a lightweight index of all
onboarded tenants. **The tenant name is the single source of truth** — it
determines both the Git branch and the GitHub Environment name.

### Registry schema (on `main` branch)

```yaml
tenants:
  - name: acme-prod
    active: true
    schedule: "0 0 * * *"
  - name: acme-dev
    active: false
  - name: axa
    active: true
    schedule: "0 0 * * *"
    exportPollMinutes: 20
    jobTimeoutMinutes: 25
```

| Field | Description |
|-------|-------------|
| `name` | Tenant identifier (lowercase, alphanumeric, hyphens). Determines branch and environment. |
| `active` | Enable scheduled backups when `true` |
| `schedule` | Optional standard cron expression (e.g. `"0 0 * * *"`). Defaults to 00:00 UTC if missing. |
| `exportPollMinutes` | Optional ISC export poll budget in minutes (default `10`). Increase for large tenants that hit `FAILED_EXTERNAL_COMMUNICATION` or poll timeouts. |
| `jobTimeoutMinutes` | Optional GitHub Actions matrix job timeout in minutes (default `15`). Set higher than `exportPollMinutes` when using a longer poll budget. |

**Per-tenant timeout overrides:** Use `exportPollMinutes` and `jobTimeoutMinutes` when a tenant consistently fails backup with ISC export communication errors or exceeds the default ~10-minute poll window.

### Scheduled backups

The **Scheduled Backup** workflow runs on explicit cron windows rather
than polling every 15 minutes. For the current fleet (all tenants on
`"0 0 * * *"`), triggers fire at midnight UTC and every 15 minutes during a
one-hour retry band (00:15–01:45 UTC) for failed or pending backups.

- **Cron-triggered runs** apply `--check-pending`: only tenants whose backup is
  still pending are included in the matrix.
- **Retry recovery:** overlapping scheduled runs do not cancel each other (`cancel-in-progress: false`).
- **Manual dispatch** (no tenant input) applies `--check-pending` only.
- **Manual dispatch with tenant** bypasses schedule and pending filters.
- When no tenants are pending, the workflow logs "No pending backups" and skips
  backup, summary, and README regeneration jobs.
- After scheduled runs that perform backups, a summary report is committed to `reports/` and `README.md` is regenerated on `main`.

When onboarding a tenant with a non-midnight schedule, add a matching cron line
to `.github/workflows/scheduled-backup.yml` (GitHub allows up to five cron
entries per workflow).

**GitHub Environments vs deployment history:** Backup jobs use each tenant's
GitHub Environment only to inject ISC credentials. GitHub also creates a Deployment record for every job that
references `environment:`; backup workflows delete that ephemeral trace when
the job finishes. Use **ISC Maintenance** (`operation: cleanup-deployments`) to sweep historical deployment records.

### Tenant descriptor (on each branch)

Each tenant branch carries a `.tenant.yaml` with full metadata:

```yaml
name: acme-prod
description: "Production tenant for Acme Corp"
active: true
url: "https://acme.api.identitynow.com"
```

The registry is maintained automatically by onboarding. Use the per-tenant **Toggle**
link in the README fleet table (`isc-toggle-<tenant>.yml`) to pause or resume daily backups.
Use the **Offboard** link (`isc-offboard-<tenant>.yml`; type `offboard` to confirm) to decommission a tenant.

## Operator workflows

| Workflow | Operations |
|----------|------------|
| ISC Lifecycle | onboard (verify/toggle/offboard also via per-tenant shortcuts) |
| ISC Backup | manual backup |
| ISC Restore | cross-tenant restore |
| ISC Config Tools | tokenize, drift-detection |
| Scheduled Backup | fleet matrix (cron + dispatch) |
| ISC Maintenance | prune-tags, cleanup-deployments |

Dispatch links are listed in the generated [README](../README.md) operations dashboard.

## Browsing with Config Hub

The [SailPoint UI Development Kit](https://github.com/sailpoint-oss/ui-development-kit) includes a **Config Hub** component for exploring backups and restoring previous versions directly to your ISC tenant. See [Setup](setup.md#config-hub-integration) for repository settings.
