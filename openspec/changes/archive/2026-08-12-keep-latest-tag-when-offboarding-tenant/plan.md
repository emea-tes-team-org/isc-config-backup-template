# Keep Latest Tag When Offboarding a Tenant — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Change offboard to retain the latest backup tag (by embedded UTC timestamp) and delete only older tenant tags plus their GitHub Releases.

**Architecture:** Add testable selection/prune helpers in `offboard.mjs` reusing `parseTagTimestamp` from `parse-tenants.mjs` and release-delete pattern from `prune-tags.mjs`. Replace `deleteMatchingTags` in `offboardTenant()` with `pruneTenantTagsOnOffboard`. No workflow YAML changes.

**Tech Stack:** Node.js 20 ESM, git CLI, optional `gh` for release delete

**Canonical test command:** `node scripts/test-offboard.mjs`

---

## Task 1: Latest tag selection helpers (TDD)

**Files:** `scripts/offboard.mjs`, `scripts/test-offboard.mjs`, `scripts/parse-tenants.mjs` (import only)

- [ ] **Step 1:** In `test-offboard.mjs`, add failing tests for `selectLatestTenantTag`:
  ```javascript
  const tags = [
    "acme-prod/2026-08-01_06-00-00",
    "acme-prod/2026-08-02_06-00-00",
    "acme-dev/2026-08-02_06-00-00",
  ];
  assert(selectLatestTenantTag(tags, "acme-prod") === "acme-prod/2026-08-02_06-00-00", "...");
  assert(selectLatestTenantTag([], "acme-prod") === null, "...");
  ```
- [ ] **Step 2:** Run `node scripts/test-offboard.mjs` — expect FAIL on missing export
- [ ] **Step 3:** In `offboard.mjs`, import `parseTagTimestamp` and implement `selectLatestTenantTag` using `listTenantTags` + max by timestamp
- [ ] **Step 4:** Run tests — selection tests PASS

**Commit:** `feat(offboard): select latest tenant backup tag by timestamp`

---

## Task 2: Delete set and prune orchestration (TDD)

**Files:** `scripts/offboard.mjs`, `scripts/test-offboard.mjs`

- [ ] **Step 1:** Add failing tests for `tagsToDeleteOnOffboard` (keeps latest, deletes older; single tag → []; invalid tags deleted when no valid latest)
- [ ] **Step 2:** Add failing test for `pruneTenantTagsOnOffboard` recording `deleteTagFn` and `releaseDeleteFn` calls
- [ ] **Step 3:** Run `node scripts/test-offboard.mjs` — expect FAIL
- [ ] **Step 4:** Implement `tagsToDeleteOnOffboard` and `pruneTenantTagsOnOffboard`; export both
- [ ] **Step 5:** Run tests — new tests PASS; update or remove old `deleteMatchingTags` test that expected all tags deleted

**Commit:** `feat(offboard): prune stale tags keeping latest on offboard`

---

## Task 3: Integrate into offboardTenant flow

**Files:** `scripts/offboard.mjs`, `scripts/prune-tags.mjs` (import/export `deleteReleaseForTag` if not already exported)

- [ ] **Step 1:** Export `deleteReleaseForTag` from `prune-tags.mjs` if needed (or duplicate minimal helper)
- [ ] **Step 2:** Replace `deleteMatchingTags(...)` block in `offboardTenant()` with:
  ```javascript
  const { kept, deleted } = pruneTenantTagsOnOffboard(tenantName, allTags, deleteRemoteTag, deleteReleaseForTag);
  if (kept) console.log(`Kept latest tag: ${kept}`);
  if (deleted.length) console.log(`Deleted ${deleted.length} older tag(s)...`);
  ```
- [ ] **Step 3:** Update file header comment
- [ ] **Step 4:** Run `node scripts/test-offboard.mjs` — all PASS

**Commit:** `feat(offboard): wire latest-tag retention into offboard flow`

---

## Task 4: Documentation

**Files:** `README.md`

- [ ] **Step 1:** Find offboard / tenant management section; change "deletes all backup tags" to "deletes older backup tags, keeps latest restore-point tag"
- [ ] **Step 2:** Note that GitHub Releases for deleted tags are removed; release on latest tag retained
- [ ] **Step 3:** Review for consistency with tenant-lifecycle spec scenarios

**Commit:** `docs: document latest-tag retention on offboard`

---

## Verification checklist

- [ ] `node scripts/test-offboard.mjs` exits 0
- [ ] No changes to `.github/workflows/offboard.yml` required
- [ ] Delta specs in `openspec/changes/keep-latest-tag-when-offboarding-tenant/specs/` match implemented behavior
