# Restore

## Cross-tenant restore

The restore workflow supports uploading configuration from one tenant's backup to a **different** target tenant. This is useful for promoting configurations from dev → staging → prod.

### Via GitHub Actions

1. Go to **Actions > ISC Restore > Run workflow** (always from `main`)
2. Enter **source ref**: source branch or backup tag (e.g., `acme-prod` or `acme-prod/2025-01-15_06-00-00`)
3. Enter the **target tenant** name (e.g., `acme-dev`)
4. Choose whether to run a full restore or semantic diff
5. Optionally specify a **vars file** for token substitution
6. Click **Run workflow**

The workflow reads backup objects from flat `backups/<TYPE>/<id>.json` at the source ref,
resolves the target branch and environment from the tenant name, reads secrets from the target
environment, and uploads backup data.

### Via CLI (local)

```bash
# Restore from tenant-b's backup to current tenant (from .env)
npm run cli -- restore local --tenant tenant-b

# Restore to a DIFFERENT target tenant by name (reads .tenant.yaml from that branch)
npm run cli -- restore local --tenant tenant-b --target tenant-c

# Restore a template set with production vars substituted
npm run cli -- restore local --tenant default --vars production --full

# Restore from a specific git ref to current tenant
npm run cli -- restore acme-prod/2025-01-15_06-00-00 --full
```

## Restore modes

| Mode | Flag | Behavior |
|------|------|----------|
| Semantic diff | default | Upload only objects whose meaningful content differs from the comparison base (`main` by default) |
| Full | `--full` | Upload the entire snapshot |

Additional options:

- `--base <ref>` — compare semantically to a specific git ref instead of `main`
- `--vars <tenant>` — apply token substitution using `vars/<tenant>.vars.yaml`
- `--dry-run` — preview what would be uploaded without calling the API

When `--tenant` names a directory that does not exist under `backups/`, restore
automatically looks in `templates/<name>/` instead.

## Path layout

Restore reads objects from flat paths on tenant branches and restore-point tags:

```
backups/ROLE/<objectId>.json
backups/SOURCE/<objectId>.json
...
```

There is no `backups/<tenant-name>/` subdirectory — the tenant branch name encodes the tenant.

## End-to-end tokenized restore

```bash
# 1. Generate template + seed vars from an existing backup
node scripts/cli.mjs tokenize create-template beta-15156 --template default

# 2. Edit vars/beta-15156.vars.yaml to fill in any gaps, then commit templates/

# 3. For a new tenant, extract its values by matching against the template
node scripts/cli.mjs tokenize find-tokens production --template default

# 4. Manually fill any unmatched tokens in vars/production.vars.yaml

# 5. Restore the template to production with its vars
npm run cli -- restore local --tenant default --vars production --full
```

See [Tokenization Guide](tokenization.md) for details on templates and vars files.
