# Proposal: Refactor Dashboard Generation from Shell to Node

## Why

The backup dashboard workflow (`dashboard.yml`) generates its markdown output using inline shell commands that parse `tenants.yaml` with `grep -A5` context windows. This is fragile: when a tenant's YAML block is shorter than 5 lines, the grep context spills into the next tenant, causing duplicate matches and newlines that corrupt the markdown table. The recent dashboard shows `true` leaking into the Tenant column and all subsequent columns shifting left — a direct result of this parsing fragility.

Shell is the wrong tool for structured YAML parsing, JSON counting, and markdown table generation. Moving this logic into a proper Node script eliminates a class of whitespace, quoting, and context-window bugs while making the generation logic testable.

## What Changes

- **Extract** `loadRegistry()` from `scripts/parse-tenants.mjs` into a new shared module `scripts/tenant-registry.mjs`.
- **Create** `scripts/generate-dashboard.mjs`: a Node script that reads the tenant registry, queries git for backup metadata, and writes a valid markdown dashboard to stdout.
- **Create** `scripts/generate-backup-stats.mjs`: a Node replacement for `scripts/backup-stats.sh` that computes backup directory statistics as JSON.
- **Update** `.github/workflows/dashboard.yml` to invoke the new Node script instead of inline shell.
- **Update** `scripts/parse-tenants.mjs` to import from the shared registry module.
- **Delete** `scripts/backup-stats.sh` once the Node replacement is wired in.
- **Add** tests for the core dashboard generation logic that do not require a real git repository.

## Capabilities

- **New Capabilities**:
  - `dashboard-generation`: Generate a markdown backup dashboard from tenant registry and git metadata.
  - `backup-stats`: Compute backup directory statistics (size, file count, added/deleted/modified) as JSON.

- **Modified Capabilities**: _None (this is a pure refactor with no behavioural changes to the dashboard output aside from fixing the table corruption)._

## Impact

- `scripts/parse-tenants.mjs` — refactored to use shared module
- `.github/workflows/dashboard.yml` — simplified to a single Node invocation
- `scripts/backup-stats.sh` — removed
- New files: `scripts/tenant-registry.mjs`, `scripts/generate-dashboard.mjs`, `scripts/generate-backup-stats.mjs`, and tests
- No external dependencies added (uses Node built-ins and existing git subprocess calls)
