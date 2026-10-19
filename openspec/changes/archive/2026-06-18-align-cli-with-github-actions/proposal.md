# Align Local CLI with GitHub Actions

## Why this matters
Currently, there is a disconnect between how the backup and restore tools are run locally versus in CI. Local users rely on a bloated `package.json` with over 20 specific `npm run` wrapper scripts (`restore:local`, `restore:cross-tenant`, etc.) that implicitly inject `.env`. GitHub Actions, the main reference point, calls the `.mjs` scripts directly and passes arguments dynamically (e.g., `node scripts/restore.mjs $SOURCE_REF --tenant $SOURCE_TENANT --target $TARGET`). Aligning the two environments reduces friction, makes debugging easier, and establishes a single unified interface that matches how the tool actually runs in production.

## What Changes
- **BREAKING**: Remove the highly specific script permutations (`restore:full`, `restore:cross-tenant`, `tokenize:*`, etc.) from `package.json`.
- Introduce a unified CLI entrypoint (e.g., `scripts/cli.mjs` or similar) that gracefully handles local `.env` loading and routes commands, OR document and enforce calling the scripts directly matching the GitHub actions exact syntax.
- If a unified CLI is introduced, update the GitHub Actions workflows to use the new unified interface, ensuring parity.

## Current state
`package.json` contains numerous permutations:
```json
    "restore": "node --env-file=.env scripts/restore.mjs",
    "restore:local": "node --env-file=.env scripts/restore.mjs local",
    "restore:full": "node --env-file=.env scripts/restore.mjs local --full",
    ...
```
GitHub Actions (`.github/workflows/restore.yml`) uses explicit commands:
```bash
CMD="node scripts/restore.mjs $SOURCE_REF --tenant $SOURCE_TENANT --target $TARGET"
```
*Convention*: The repo relies on plain `.mjs` scripts with no heavy framework dependencies.

## Commands you will need
| Command | Expected Result |
|---|---|
| `node scripts/restore.mjs --help` | Should show help (if implemented) or fail gracefully. |
| `npm run test` (if added) | Tests pass. |

## Scope
**In scope:** `package.json` (scripts section), `scripts/*.mjs` (for argument parsing and routing), `.github/workflows/*.yml`.
**Out of scope:** Core logic of backup/restore/tokenization (only the execution routing changes).

## Impact
All developers will change how they invoke the scripts locally, migrating away from `npm run <permutation>` towards a single, consistent CLI that matches the CI workflows.
