# Retrospective: Operations UX Refactor

**Change:** 2026-08-12-operations-ux-refactor  
**Completed:** 2026-08-12

## What shipped

- Six consolidated GitHub Actions workflows replacing 14 legacy files
- Generated README ops dashboard with fleet table and dispatch links
- Flat `backups/` layout on tenant branches (Config Hub aligned)
- Restore redesign with explicit `source_ref` from `main`
- Fleet cleanup: workflow copies removed and nested backup paths migrated on all tenants

## Evidence

- Tests: `test-workflow-references`, `test-generate-readme`, `test-restore`, `test-backup` — all pass
- `openspec validate --all` — 31/31 pass
- Fleet: cleanup + migration scripts pushed to fernando, andre, ksb, abb-pov, abb-poc (company19271-poc already flat)

## Misses / follow-up

- Remote GitHub Actions menu still shows legacy workflow names until consolidated YAML merges to `main` and old workflows are deleted on remote
- Post-merge manual smoke: trigger each consolidated workflow from README links once
- Legacy capability specs (backup, scheduled-backup, etc.) remain separate; full journey-spec merge deferred to a future consolidation pass

## Lessons

- Git worktrees are required for fleet scripts on a dirty working tree
- OpenSpec archive requires MODIFIED requirement headers to match main spec titles exactly
- Dry-run fleet scripts before live push catches checkout issues early
