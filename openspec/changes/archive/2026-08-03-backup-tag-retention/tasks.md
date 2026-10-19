## 1. Prune Tags Script — Core Logic

- [x] 1.1 Create `scripts/prune-tags.mjs` with exported `groupTagsByPrefix(tags)` that groups tags by tenant prefix (text before first `/`)
- [x] 1.2 Export `selectTagsToDelete(tags, keep = 7)` using `parseTagTimestamp` from `parse-tenants.mjs` — sort descending by embedded timestamp, return tags beyond the keep limit; skip tags with null timestamp
- [x] 1.3 Export `listRemoteTags()` and `deleteRemoteTagsBatch(tags, deleteFn)` — batch refspec deletions in chunks (~50 per push)
- [x] 1.4 Implement `pruneTags({ keep, dryRun })` orchestrator returning `{ kept, deleted, skipped }` per prefix summary
- [x] 1.5 Add CLI entry: `node scripts/prune-tags.mjs [--dry-run] [--keep N]` with `--keep` defaulting to 7

## 2. GitHub Actions Workflow

- [x] 2.1 Create `.github/workflows/prune-tags.yml` with cron `0 3 * * 0` and `workflow_dispatch` input `dry_run` (boolean)
- [x] 2.2 Add concurrency group `prune-tags` with `cancel-in-progress: true`
- [x] 2.3 Configure checkout with `fetch-depth: 0`, Node 20, git user, `contents: write`, token from `ADMIN_TOKEN` or `GITHUB_TOKEN`
- [x] 2.4 Run `node scripts/prune-tags.mjs` passing `--dry-run` when input is true; write step summary with per-prefix kept/deleted counts

## 3. Automated Tests

- [x] 3.1 Create `scripts/test-prune-tags.mjs` covering: prune 10→7 tags, no-op at ≤7 tags, embedded-timestamp sort beats creatordate order, malformed tags skipped, orphan prefix pruned
- [x] 3.2 Test dry-run mode: `selectTagsToDelete` returns correct set; mock delete not invoked when `dryRun: true`
- [x] 3.3 Test batch delete chunks large tag sets correctly (mock deleteFn call count)
- [x] 3.4 Update `scripts/test-workflow-references.mjs` to assert `prune-tags.yml` exists and references `prune-tags.mjs`
- [x] 3.5 Map scenarios: Tenant with more than 7 tags (3.1), 7 or fewer unchanged (3.1), embedded timestamp sort (3.1), malformed skipped (3.1), orphan prefix (3.1), dry run (3.2), manual delete (3.1), branch/registry unchanged (design constraint — document in test comment or integration assertion)
- [x] 3.6 Map scenarios: Scheduled weekly (2.1), workflow invokes script (2.4), write permissions (2.3), concurrency (2.2)

## 4. Documentation

- [x] 4.1 Update README: add ISC Prune Tags workflow section — schedule (Sunday 03:00 UTC), retention policy (7 newest restore points), dry-run input, restore impact
- [x] 4.2 Update `scripts/prune-tags.mjs` header comment with usage examples
- [x] 4.3 N/A — no CLI route in v1; no API/connector docs affected

## 5. Changelog

- [x] 5.1 Create or update changelog entry for backup tag retention capability
- [x] 5.2 Confirm entry covers weekly prune workflow and 7-tag retention policy
