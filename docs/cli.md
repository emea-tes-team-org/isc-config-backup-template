# CLI Reference

All commands are routed through `scripts/cli.mjs`:

```bash
npm run cli -- <command> [args]
# or
node scripts/cli.mjs <command> [args]
```

## Backup

Check out the tenant branch and run:

```bash
git checkout acme-prod
npm run cli -- backup
```

Or trigger **ISC Backup** via GitHub Actions. Every successful backup pushes a restore-point tag whose commit contains only `backups/`. A GitHub Release with a downloadable zip of `backups/` is published **only when** that tag's backup content differs from the previous restore-point tag for the tenant (unchanged backups still get a tag, but no new release). Tenant branch commits still include branch metadata (`.tenant.yaml`, `.gitignore`).

Local CLI backup does not create releases — only the GitHub Actions workflow does.

**Troubleshooting:** Tenant branches contain only backup data (no `scripts/`). After switching to a tenant branch for commit/tag steps, backup workflows restore tag helper scripts from `main` via `git show` before creating restore-point tags.

## Onboarding

```bash
# Interactive onboarding
npm run cli -- onboard --interactive

# Batch onboarding from config file
npm run cli -- onboard --config tenant.yaml

# List all registered tenants
npm run cli -- onboard --list

# Update secrets for an existing tenant
npm run cli -- onboard --update acme-prod
```

Example `tenant.yaml`:

```yaml
tenant:
  name: acme-prod
  url: https://acme.api.identitynow.com
  client_id: a1b2c3d4...
  client_secret: x9y8z7w6...
  active: true
  description: "Production tenant for Acme Corp"
```

## Verify

```bash
npm run cli -- verify <tenant-name>
npm run cli -- verify <tenant-name> --backup
```

From GitHub Actions, use the per-tenant **Verify** link in the README fleet table (`isc-verify-<tenant>.yml`) — no inputs required.

## Schedule toggle

```bash
npm run cli -- schedule-toggle acme-prod
```

From GitHub Actions, use the per-tenant **Toggle** link in the README fleet table (`isc-toggle-<tenant>.yml`) — no inputs required.

## Offboard

```bash
npm run cli -- offboard acme-prod
```

From GitHub Actions, use the per-tenant **Offboard** link in the README fleet table (`isc-offboard-<tenant>.yml`). You must type `offboard` in the confirm field before the workflow dispatches lifecycle offboard.

## Restore

See [Restore Guide](restore.md) for full restore documentation.

```bash
# Restore from tenant-b's backup to current tenant (from .env)
npm run cli -- restore local --tenant tenant-b

# Restore to a DIFFERENT target tenant by name
npm run cli -- restore local --tenant tenant-b --target tenant-c

# Restore a template set with production vars substituted
npm run cli -- restore local --tenant default --vars production --full

# Restore from a specific git ref
npm run cli -- restore acme-prod/2025-01-15_06-00-00 --full
```

## Tokenize

See [Tokenization Guide](tokenization.md).

```bash
npm run cli -- tokenize create-template beta-15156 --template default
npm run cli -- tokenize find-tokens production --template default
npm run cli -- tokenize diff-tenants beta-15156 production
```
