[Discourse Topics](https://developer.sailpoint.com/discuss/tag/workflows)
[Issues](https://github.com/sailpoint-oss/repo-template/issues)
[Latest Releases](https://github.com/sailpoint-oss/repo-template/releases)
[Contributor Shield](https://github.com/sailpoint-oss/repo-template/graphs/contributors)

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

## Discuss

[Click Here](https://developer.sailpoint.com/dicuss/tag/{tagName}) to discuss this tool with other users.
