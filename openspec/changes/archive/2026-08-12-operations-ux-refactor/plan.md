# Plan: Operations UX Refactor

## Execution order

Matches grilling Q15 priority: quick visibility wins before deep refactors.

| Phase | Scope | Outcome |
|-------|-------|---------|
| **1** | Sync kill + branch cleanup | Data-only tenant branches |
| **2** | README template + generator + docs split | Operator landing page |
| **3** | Workflow consolidation (6 cards) | Reduced Actions menu |
| **4** | Restore `source_ref` redesign | Restore from main only |
| **5** | Flat `backups/` migration | Path simplification + Config Hub alignment |
| **6** | Spec consolidation | Journey specs match operator model |

## Phase 1 — Sync kill (1–2 days)

1. Delete `sync-workflows.yml`
2. Script: for each tenant in `tenants.yaml`, remove `.github/workflows/` from branch, push
3. Verify tenant branches contain only data artifacts

**Test:** `node scripts/test-workflow-references.mjs`

## Phase 2 — Operations dashboard (2–3 days)

1. Split README into `docs/*`
2. Create `README.template.md` + generator
3. Integrate into scheduled backup summary pipeline
4. Remove `dashboard.yml`

**Test:** new `scripts/test-generate-readme.mjs` (or extend dashboard tests)

## Phase 3 — Workflow consolidation (3–4 days)

Build four new workflow files; port job logic from existing YAML (reuse shell blocks initially). ISC Lifecycle validation job checks required inputs per `operation`.

Delete 8 superseded workflows. Update workflow reference tests.

**Test:** `node scripts/test-workflow-references.mjs`

## Phase 4 — Restore redesign (1–2 days)

Add `source_ref` to restore workflow. Update `restore.mjs` to accept explicit ref parameter in CI context.

**Test:** `node scripts/test-restore.mjs`

## Phase 5 — Flat backup migration (2–3 days)

1. Update all path references in scripts
2. Migration script per tenant branch
3. Re-run backup to validate; test restore from new tags
4. Update onboarding for new tenants

**Test:** `node scripts/test-backup.mjs`, restore smoke on fernando → fernando

## Phase 6 — Spec consolidation (1–2 days)

Merge specs per design map. Archive change when complete.

**Test:** `openspec validate --all`

## Canonical test commands

```bash
node scripts/test-workflow-references.mjs
node scripts/test-restore.mjs
node scripts/test-generate-readme.mjs   # new
node scripts/test-backup.mjs
openspec validate --all
```

## Rollback

- Phases 1–3: revert workflow YAML + README commits
- Phase 5: keep migration script; nested paths recoverable from git history if migration commits are reverted

## Breaking changes notice

Document in CHANGELOG:
- Restore workflow inputs (`source_ref` required; no branch selector)
- Workflow file renames/deletions
- Flat backup paths on tenant branches
- Config Hub: use tenant branch + `Backups Path: backups`
