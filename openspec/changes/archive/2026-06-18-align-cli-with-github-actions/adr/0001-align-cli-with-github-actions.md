# 0001: Align CLI with GitHub Actions

## Status
Proposed

## Context
The project's CLI interface grew organically, leading to over 20 explicit `npm run ...` script variants in `package.json` that exist primarily to inject local environment variables (`node --env-file=.env`). This abstracts the true invocation away from local developers, while GitHub Actions calls the raw scripts directly. Because GitHub Actions is the main reference for production behavior, this disconnection causes friction when debugging or extending the tool.

## Decision
We will unify the CLI interface. Instead of scattering execution permutations across `package.json`, we will provide a unified execution path (e.g., a single router script or standardized `npm run cli` entrypoint) that mirrors or matches the GitHub Actions invocation style. The heavily customized `package.json` scripts will be removed.

## Consequences
- **Positive**: `package.json` becomes much cleaner.
- **Positive**: Developers run commands locally exactly as they run in CI, reducing environment-specific bugs.
- **Positive**: Future scripts or arguments can be added without needing a corresponding wrapper entry in `package.json`.
- **Negative**: Existing developers must learn the unified CLI syntax instead of relying on the NPM script aliases.
