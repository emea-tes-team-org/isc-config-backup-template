# Config Hub CI/CD — ISC Configuration Backup

Automated daily backup of SailPoint Identity Security Cloud (ISC) tenant configuration using the Configuration Hub and SP-Config APIs. Configuration objects are stored as JSON files in this repository, with git history providing a complete audit trail of changes over time.

{{OPS_DASHBOARD}}

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
