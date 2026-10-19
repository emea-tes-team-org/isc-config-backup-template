## 1. Extract shared tenant registry

- [x] 1.1 Create `scripts/tenant-registry.mjs` containing `loadRegistry()` and any YAML-parsing helpers, with no CLI side effects.
- [x] 1.2 Update `scripts/parse-tenants.mjs` to import `loadRegistry()` from `scripts/tenant-registry.mjs` and verify `node scripts/test-parse-tenants.mjs` still passes.
- [x] 1.3 Ensure `tenant-registry.mjs` preserves the existing `active` boolean conversion and description parsing behavior.

## 2. Create dashboard generator

- [x] 2.1 Create `scripts/generate-dashboard.mjs` with a `generateDashboard(registry, gitFunctions)` core function that returns the markdown string.
- [x] 2.2 Implement helper functions for git metadata: `getLastCommitDate(branch)`, `getObjectCount(branch, tenant)`, `getRecentTags(limit)`.
- [x] 2.3 Implement tenant row rendering with status logic (`Healthy`, `Empty backup`, `No backups`) and markdown escaping for descriptions.
- [x] 2.4 Add a CLI entry point that loads the registry, invokes the core function, and writes the markdown to stdout.
- [x] 2.5 Create `scripts/test-generate-dashboard.mjs` that exercises the core function with mocked tenant data and git helpers.

## 3. Replace backup-stats shell script

- [x] 3.1 Create `scripts/generate-backup-stats.mjs` that outputs the same JSON shape as `scripts/backup-stats.sh`.
- [x] 3.2 Implement size, file count, and git status parsing (`added`, `deleted`, `modified`) using Node built-ins.
- [x] 3.3 Handle the missing `backups/` directory case by returning zeroed JSON.
- [x] 3.4 Delete `scripts/backup-stats.sh` once the Node replacement is verified.

## 4. Update workflow and verify

- [x] 4.1 Replace the inline shell in `.github/workflows/dashboard.yml` with `node scripts/generate-dashboard.mjs > DASHBOARD.md`.
- [x] 4.2 Preserve the existing artifact upload and `GITHUB_STEP_SUMMARY` steps.
- [x] 4.3 Run `node scripts/generate-dashboard.mjs` locally (with available tenant branches) and confirm the Tenant Overview table has no shifted columns.
- [x] 4.4 Run `openspec validate refactor-dashboard-generation --type change --strict` before archiving.
