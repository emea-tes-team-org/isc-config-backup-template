[Discourse Topics](https://developer.sailpoint.com/discuss/tag/workflows)
[Issues](https://github.com/sailpoint-oss/repo-template/issues)
[Latest Releases](https://github.com/sailpoint-oss/repo-template/releases)
[Contributor Shield](https://github.com/sailpoint-oss/repo-template/graphs/contributors)

# Config Hub CI/CD — ISC Configuration Backup

Automated daily backup of SailPoint Identity Security Cloud (ISC) tenant configuration using the Configuration Hub and SP-Config APIs. Configuration objects are stored as JSON files in this repository, with git history providing a complete audit trail of changes over time.

## Operations Dashboard

*Fleet status updated: 2026-10-19 11:17:03 UTC*

*Generated: 2026-10-19 11:17:03 UTC*

No tenants found.

## Quick Actions

| Workflow | Dispatch |
|----------|----------|
| ISC Lifecycle | [Run](https://github.com/emea-tes-team-org/isc-config-backup-template/actions/workflows/isc-lifecycle.yml) |
| ISC Backup | [Run](https://github.com/emea-tes-team-org/isc-config-backup-template/actions/workflows/isc-backup.yml) |
| ISC Restore | [Run](https://github.com/emea-tes-team-org/isc-config-backup-template/actions/workflows/isc-restore.yml) |
| ISC Config Tools | [Run](https://github.com/emea-tes-team-org/isc-config-backup-template/actions/workflows/isc-config-tools.yml) |
| Scheduled Backup | [Run](https://github.com/emea-tes-team-org/isc-config-backup-template/actions/workflows/scheduled-backup.yml) |
| ISC Maintenance | [Run](https://github.com/emea-tes-team-org/isc-config-backup-template/actions/workflows/isc-maintenance.yml) |

---

## Recent Backup Tags

No backup tags found.

---

*Use `node scripts/parse-tenants.mjs --list` to see all registered tenants.*

## Architecture at a glance

- **`main`** holds scripts, `tenants.yaml`, the six operator workflows, generated `README.md`, and backup summary reports.
- **Tenant branches** (named after the tenant) store flat `backups/<TYPE>/<id>.json`, `.tenant.yaml`, and optional `templates/` / `vars/`.
- **Restore-point tags** (`<tenant>/YYYY-MM-DD_HH-MM-SS`) snapshot flat `backups/` for download and cross-tenant restore.
- All workflows run from **`main`**; tenant branches are data-only (no copied workflow files).

## Latest backup report

No backup summary reports committed yet.

## Documentation

| Guide | Description |
|-------|-------------|
| [Setup](docs/setup.md) | Onboarding, credentials, Config Hub settings |
| [Architecture](docs/architecture.md) | Branch model, registry, scheduled backups, workflows |
| [CLI Reference](docs/cli.md) | Local commands mirroring GitHub Actions |
| [Tokenization](docs/tokenization.md) | Templates, vars files, environment-specific values |
| [Restore](docs/restore.md) | Cross-tenant restore via Actions or CLI |

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

## Discuss

[Click Here](https://developer.sailpoint.com/dicuss/tag/{tagName}) to discuss this tool with other users.
