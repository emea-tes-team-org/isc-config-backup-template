# Backup Tag Retention Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add a weekly GitHub Action that prunes backup git tags to the 7 newest restore points per tenant prefix.

**Architecture:** New `scripts/prune-tags.mjs` with pure selection logic importing `parseTagTimestamp` from `parse-tenants.mjs`. Tag deletion reuses remote ref deletion patterns from `offboard.mjs` with batched pushes. Single workflow `prune-tags.yml` scheduled Sunday 03:00 UTC with optional dry-run dispatch.

**Tech Stack:** Node.js 20 ESM, git CLI, GitHub Actions schedule + workflow_dispatch

**Canonical test command:** `node scripts/test-prune-tags.mjs`

---

## Task 1: Selection Logic (TDD)

- [ ] **Step 1:** Create `scripts/test-prune-tags.mjs` with failing tests for `selectTagsToDelete(tags, 7)`:
  - 10 valid tags → returns 3 oldest
  - 5 valid tags → returns empty array
  - tags with mixed valid/invalid → invalid excluded from both keep and delete sets
  - newer embedded timestamp wins regardless of input order
- [ ] **Step 2:** Run `node scripts/test-prune-tags.mjs` — expect failures
- [ ] **Step 3:** Create `scripts/prune-tags.mjs` exporting `selectTagsToDelete` importing `parseTagTimestamp` from `./parse-tenants.mjs`
- [ ] **Step 4:** Implement sort by `parseTagTimestamp` descending; slice from index `keep`
- [ ] **Step 5:** Export `groupTagsByPrefix(tags)` — split on first `/`, skip tags without `/`
- [ ] **Step 6:** Run `node scripts/test-prune-tags.mjs` — selection tests pass
- [ ] **Commit:** `feat: add prune-tags selection logic with tests`

## Task 2: Remote Tag Operations (TDD)

- [ ] **Step 1:** Add tests for `deleteRemoteTagsBatch(tags, deleteFn, chunkSize)` — mock deleteFn, verify chunking at 50
- [ ] **Step 2:** Implement `listRemoteTags()` (mirror `offboard.mjs` `git ls-remote --tags origin` parsing)
- [ ] **Step 3:** Implement `deleteRemoteTagsBatch` with chunked refspec pushes
- [ ] **Step 4:** Implement `pruneTags({ keep = 7, dryRun = false })` returning summary `{ prefixes: [{ prefix, kept, deleted, skipped }] }`
- [ ] **Step 5:** Add CLI arg parsing: `--dry-run`, `--keep N`
- [ ] **Step 6:** Run `node scripts/test-prune-tags.mjs` — all pass
- [ ] **Commit:** `feat: add prune-tags remote deletion and orchestrator`

## Task 3: GitHub Actions Workflow

- [ ] **Step 1:** Create `.github/workflows/prune-tags.yml` mirroring `offboard.yml` permissions/token pattern
- [ ] **Step 2:** Add schedule `cron: '0 3 * * 0'` and `workflow_dispatch` with `dry_run` boolean input
- [ ] **Step 3:** Add `concurrency: group: prune-tags, cancel-in-progress: true`
- [ ] **Step 4:** Steps: checkout (`fetch-depth: 0`), setup node 20, configure git user, run prune script with dry-run flag from input
- [ ] **Step 5:** Add step summary formatting from script output (or parse stdout)
- [ ] **Step 6:** Update `scripts/test-workflow-references.mjs`; run `node scripts/test-workflow-references.mjs`
- [ ] **Commit:** `feat: add weekly prune-tags GitHub Actions workflow`

## Task 4: Documentation and Changelog

- [ ] **Step 1:** Update README with ISC Prune Tags section (schedule, retention, dry-run, restore impact)
- [ ] **Step 2:** Add script header comment in `prune-tags.mjs`
- [ ] **Step 3:** Update CHANGELOG.md
- [ ] **Step 4:** Run `openspec validate backup-tag-retention --type change --strict`
- [ ] **Commit:** `docs: document backup tag retention workflow`

---

## Verification Checklist

```bash
node scripts/test-prune-tags.mjs
node scripts/test-workflow-references.mjs
openspec validate backup-tag-retention --type change --strict
```

All tests must pass before marking change complete.

## Migration Notes (Operator)

1. Run manual `workflow_dispatch` with `dry_run: true` first to review deletions
2. Run manual `workflow_dispatch` without dry-run for initial catch-up prune
3. Weekly schedule handles ongoing retention automatically
