# Design: CLI Alignment

## Context
The project currently manages CLI script execution via a long list of `package.json` scripts (e.g., `restore:local`, `restore:full`, `tokenize:find-tokens`). These scripts act as convenience wrappers that inject the local `.env` file via `node --env-file=.env`. Conversely, GitHub Actions runs the scripts directly (`node scripts/restore.mjs ...`) and injects secrets natively into the environment. This discrepancy makes local debugging harder because developers are using an abstraction (`npm run <permutation>`) that differs from the execution path in CI, which is the main reference point.

## Goals
- Make local execution closely mirror GitHub Actions execution.
- Clean up `package.json` by removing over 20 specific script permutations.
- Provide a single, intuitive way to run all scripts locally without having to manually prepend `node --env-file=.env`.

## Non-Goals
- We are not rewriting the core backup, restore, or tokenize logic.
- We are not migrating the repository to a heavy framework.

## Decisions
1. **Single Entrypoint wrapper (unified CLI)**: We will create a single `scripts/cli.mjs` that acts as a router. It will load `.env` only when the file is present and delegate to the existing `.mjs` scripts via child process spawning.
2. **Manual argument parsing**: The router will use built-in `process.argv` parsing rather than adding a CLI framework dependency. This keeps the project dependency-free beyond its existing libraries (`js-yaml`, `libsodium-wrappers`).
3. **Spawn, not dynamic import**: The router will spawn `node scripts/<command>.mjs [args]` so that each script receives the exact `process.argv` it expects, without mutating the parent process argument vector.
4. **Remove specific `package.json` scripts**: Only keep generic entries (`cli`, `start`) and basic lifecycle scripts. All per-command wrappers (`restore:local`, `tokenize:find-tokens`, etc.) are removed.
5. **Update GitHub Actions**: Workflows will be updated to call `node scripts/cli.mjs <command> [args]` so that CI uses the same invocation pattern as local development.

## Risks / Trade-offs
- **Breaking muscle memory**: Users accustomed to `npm run restore:cross-tenant` will need to adapt to a standard CLI format like `npm run cli -- restore --cross-tenant`.
- **Complexity in router**: Writing a custom router adds a tiny bit of overhead, though a library like `commander` or `mri` could mitigate this.

## Migration Plan
1. Introduce the CLI router/wrapper.
2. Update GitHub Actions workflows.
3. Drop the `package.json` scripts.
4. Update `README.md` to reflect the new standard invocation commands.

## Open Questions
- Resolved: Manual parsing was chosen to avoid adding dependencies. A future enhancement could adopt `commander` or `mri` if the command surface grows significantly.
