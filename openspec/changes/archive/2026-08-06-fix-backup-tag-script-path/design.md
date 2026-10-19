## Context

Backup workflows check out `main` for scripts, fetch tenant `backups/`, run `node scripts/cli.mjs backup`, then `git checkout -B <tenant>` to commit. Tag creation uses `create-backup-tag.sh`, which must read `HEAD:backups` on the tenant branch. Tenant branches do not include `scripts/`.

The release step in `backup.yml` already uses `git show main:scripts/create-backup-release.sh` — proven pattern on tenant branch checkout.

## Goals / Non-Goals

**Goals:**
- Tag helper scripts available on every tag invocation in both workflows
- Workflow succeeds when backup commit and tag both complete
- Automated test coverage for script restore pattern

**Non-Goals:**
- Changing tag semantics (backups-only commits)
- Syncing full `scripts/` tree to tenant branches
- Fixing retry concurrency or export polling

## Decisions

### D1: Script restore mechanism
- **Choice:** Inline `git show main:scripts/<file>` to temp path, then `bash` (matches release step)
- **Reason:** No working-tree side effects on tenant branch; works with shallow checkout if `main` is available
- **Considered alternatives:** `git checkout main -- scripts/...` (mutates tree); absolute path from initial checkout (lost after branch switch)

### D2: Scripts to restore
- **Choice:** `create-backup-tag.sh` only — it delegates to `push-backup-tag.sh` via `$(dirname "$0")`; restore all three to temp dir preserving relative paths OR single wrapper script
- **Reason:** `create-backup-tag.sh` calls `bash "$(dirname "$0")/push-backup-tag.sh"` — temp copy must preserve sibling layout
- **Implementation:** Restore trio into `$(mktemp -d)/scripts/` mirroring repo layout

### D3: Shared workflow snippet
- **Choice:** Duplicate inline block in both workflows (YAGNI); extract helper script on `main` only if duplication becomes painful
- **Reason:** Two call sites; shared shell script on main still needs `git show` bootstrap

## Risks / Trade-offs

- [Risk] Shallow clone lacks `main` ref on tenant-only checkout → Mitigation: workflows always checkout `main` first with `fetch-depth: 1`
- [Trade-off] Temp directory per tag invocation → Acceptable; negligible cost

## Migration Plan

1. Update both workflow tag steps
2. Extend workflow reference tests
3. Deploy to `main`; next scheduled run validates tags created
4. No tenant branch migration required
