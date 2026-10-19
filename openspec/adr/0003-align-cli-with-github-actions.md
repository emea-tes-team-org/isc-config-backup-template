# ADR-0003: Align Local CLI with GitHub Actions via Unified Router

## Status

accepted

## Context

The repository manages backup, restore, tokenization, and tenant onboarding through plain `.mjs` scripts. Local developers invoke these scripts through a large number of `package.json` wrappers such as `restore:local`, `restore:full`, `tokenize:find-tokens`, and `tenants:list`. Each wrapper prepends `node --env-file=.env` so that credentials in a local `.env` file are injected automatically.

GitHub Actions, which is the main production execution path, calls the same `.mjs` scripts directly (e.g., `node scripts/restore.mjs ...`) and receives credentials from repository/environment secrets. This creates two problems:

1. Local developers use command syntax that differs from CI, making debugging and documentation harder.
2. `package.json` accumulates over 20 highly specific permutations that are tedious to maintain and document.

The team wants a single, stable invocation interface that works identically for local development and CI, while keeping the project free of heavy frameworks.

## Decision

**Introduce a unified CLI router at `scripts/cli.mjs`.**

The router:

- Loads a local `.env` file when it exists, without failing when the file is absent (CI/production behavior).
- Maps a small set of commands (`backup`, `restore`, `tokenize`, `onboard`, `tenants`, `verify`) to the corresponding `scripts/<command>.mjs` script.
- Spawns the target script as a child process with `stdio: 'inherit'` so that arguments and exit codes are passed through unchanged.
- Uses manual `process.argv` parsing rather than a third-party CLI framework to avoid new dependencies.

**Reduce `package.json` scripts to generic entrypoints only** (`cli`, `start`, and any standard lifecycle scripts). All command-specific wrappers are removed.

**Update GitHub Actions workflows** to invoke `node scripts/cli.mjs <command> [args]` so that CI and local development share the same routing layer and argument structure.

## Consequences

**Positive:**

- Local invocation mirrors CI invocation: `npm run cli -- restore ...` and `node scripts/cli.mjs restore ...` are structurally identical.
- `package.json` is significantly smaller and easier to maintain.
- No new runtime dependencies are introduced.
- Existing script logic (backup, restore, tokenization, onboarding) is unchanged; only the execution routing layer changes.
- Missing `.env` in CI does not break the router because it loads the file conditionally.

**Negative:**

- Developers must learn the new `npm run cli -- <command>` pattern instead of muscle-memory commands like `npm run restore:local`.
- The custom router must be kept in sync when new top-level scripts are added; the convention is to add a routing entry in `scripts/cli.mjs` rather than a new `package.json` wrapper.

## Supersedes

None.
