# Brainstorm: Make Releases Only the Contents of ./backups

Raw capture from design exploration (2026-08-05).

## Background

Backup workflows (`backup.yml`, `scheduled-backup.yml`) create git tags named `<tenant>/<YYYY-MM-DD_HH-MM-SS>` after each successful run. Operators use these tags as restore points via the ISC Restore workflow ("Use workflow from" tag selector) and the GitHub Tags/Releases UI.

Today each tag points at the **tenant branch commit**, whose tree includes branch metadata (`.tenant.yaml`, `.gitignore`) in addition to `backups/<tenant>/`. Downloading a tag's source archive or browsing the tagged tree therefore exposes non-backup files. Prior offboard brainstorm established that operators call these tags "releases" even though they are lightweight git tags, not GitHub Release objects.

Restore reads object paths at `backups/<tenant>/<TYPE>/<id>.json` via `git cat-file`; it does not require `.tenant.yaml` at the tag ref.

## Decision Chain

### Q1: What does "releases" mean here?

**Decision:** **Git backup tags** (`<tenant>/<timestamp>`), not GitHub Release objects. Same convention as prior tenant-lifecycle work. Goal is the **tagged commit tree** contains only `./backups` when viewed or downloaded from GitHub.

**Rejected:** Attaching GitHub Release zip assets only — adds API surface and duplicates what git tags already provide.

### Q2: Should tenant branch commits change?

**Decision:** **No.** Tenant branches keep their current layout (`.tenant.yaml`, `.gitignore`, `backups/<tenant>/`). Only the **tag ref** moves to a separate backups-only commit created at tag time.

**Reason:** Branch layout supports onboarding, tokenize checkout, and drift workflows. Narrow change to restore-point refs.

**Rejected:** Rewriting branch commits to backups-only — breaks branch metadata and complicates tokenize/drift checkout patterns.

### Q3: How to build a backups-only tag commit?

**Decision:** After the tenant branch push (or when tagging unchanged HEAD), build a new root tree containing **only** the `backups/` subtree from the branch tip using `git commit-tree`:

1. Resolve `BACKUPS_TREE=$(git rev-parse HEAD:backups)`
2. Build root tree: `printf '040000 tree %s\tbackups\n' "$BACKUPS_TREE" | git mktree`
3. `TAG_COMMIT=$(git commit-tree "$ROOT_TREE" -m "backup: <timestamp> snapshot (backups only)")`
4. `git tag "$TAG_NAME" "$TAG_COMMIT"` then push via existing retry helper

**Reason:** No orphan branch checkout; branch HEAD unchanged; restore paths unchanged (`backups/<tenant>/...` still valid at tag).

**Rejected:** Tagging `HEAD:backups` tree directly — root would be `<tenant>/...` without `backups/` prefix, breaking restore path resolution.

**Rejected:** GitHub Release with filtered archive — unnecessary when tag tree is correct.

### Q4: Unchanged backup runs (tag-only)?

**Decision:** Apply the same backups-only tag commit logic when scheduled backup tags current HEAD without a new branch commit (`scheduled-backup.yml` unchanged path).

### Q5: CLI parity?

**Decision:** Tagging is workflow-only today (CLI backup does not push tags). **No CLI change** unless local tag push is added later. Document that restore-point tags are created by Actions.

### Q6: Impact on tag retention and offboard?

**Decision:** **No semantic change** to prune-tags or offboard — tag naming and prefix grouping unchanged. Existing tags on old branch commits remain until pruned; new tags use backups-only commits.

## Design Trade-offs

| Trade-off | Acceptance |
|-----------|------------|
| Tag commit ≠ branch commit (divergent refs) | Intended — branch history for ops; tag for clean restore snapshot |
| Existing tags still full branch trees until pruned | Acceptable — retention window is 7 tags; old shape ages out |
| Extra commit-tree step per backup | Small cost; extract shared shell helper for both workflows |
| Tag commits are unreachable from branch | OK — tags are the access path; prune-tags deletes old ones |

## Capability Fit (existing openspec/specs/)

- Modify **backup** — "GitHub Actions backup workflow commits and tags" requirement
- Modify **scheduled-backup** — matrix backup tagging behavior (if covered there; check spec)
- No new capability — behavior refinement of restore-point tags

## Validated Scope for Proposal

**In scope:**
- Shared helper (e.g. `scripts/create-backup-tag.sh`) to create backups-only tag commit and push
- Update `backup.yml` and `scheduled-backup.yml` to use helper instead of `git tag` on branch HEAD
- Tests asserting tag tree contains `backups/` and excludes `.tenant.yaml`
- README note on tag contents

**Out of scope:**
- GitHub Release objects / release assets API
- Rewriting existing tags on remote
- CLI local tag creation
- Changing tenant branch commit structure
