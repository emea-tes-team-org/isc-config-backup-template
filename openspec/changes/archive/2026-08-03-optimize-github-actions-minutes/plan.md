# Optimize GitHub Actions Minutes — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development
> to implement this plan task-by-task.

**Goal:** Cut scheduled backup GitHub Actions minute usage by ~95% while preserving backup reliability, manual dispatch, and operator reporting.

**Architecture:** Fix pending detection in `parse-tenants.mjs`, re-apply schedule gate in `scheduled-backup.yml`, replace 96×/day cron polling with 8 window-specific triggers, skip idle jobs, and add npm cache + backup timeout.

**Tech Stack:** Node.js 20 ESM, GitHub Actions, npm, existing `test-*.mjs` scripts

**Canonical test command:** `node scripts/test-<module>.mjs` (no unified npm test script)

---

## Task 1: Fix tag timestamp detection (TDD)

**Files:** `scripts/parse-tenants.mjs`, `scripts/test-parse-tenants.mjs`

- [ ] **Step 1:** Write failing test — two tags same creatordate, different name timestamps; assert newer name wins
- [ ] **Step 2:** Run `node scripts/test-parse-tenants.mjs` → expect FAIL on new test
- [ ] **Step 3:** Add exported `parseTagTimestamp(tagName)` returning `Date | null`
- [ ] **Step 4:** Rewrite `getLatestTagMap()`: list tags without creatordate sort; keep max parsed timestamp per tenant prefix
- [ ] **Step 5:** Run `node scripts/test-parse-tenants.mjs` → all PASS
- [ ] **Step 6:** Run `node scripts/test-cron-utils.mjs` → exit 0
- [ ] **Step 7:** Commit: `fix: parse backup time from tag name not creatordate`

**Verify pending locally:**
```bash
node scripts/parse-tenants.mjs --active-only --check-pending | jq '.include | map(.tenant)'
```
Healthy tenants with today's tags must not appear.

---

## Task 2: Re-enable schedule gate

**Files:** `.github/workflows/scheduled-backup.yml`

- [ ] **Step 1:** In `prepare-matrix` else branch, set:
  ```bash
  ALL_ACTIVE=$(node scripts/parse-tenants.mjs --active-only)
  SCHEDULE_MATCH=$(node scripts/parse-tenants.mjs --active-only --check-schedule)
  if [ "${{ github.event_name }}" = "schedule" ]; then
    MATRIX=$(node scripts/parse-tenants.mjs --active-only --check-schedule --check-pending)
  else
    MATRIX=$(node scripts/parse-tenants.mjs --active-only --check-pending)
  fi
  ```
- [ ] **Step 2:** Run `node scripts/test-workflow-references.mjs` → exit 0
- [ ] **Step 3:** Run `node scripts/test-generate-report.mjs` → exit 0
- [ ] **Step 4:** Commit: `ci: apply --check-schedule filter on cron-triggered backups`

---

## Task 3: Narrow cron entries

**Files:** `.github/workflows/scheduled-backup.yml`, `README.md`

- [ ] **Step 1:** Remove `cron: '*/15 * * * *'`
- [ ] **Step 2:** Add cron entries (current all-midnight fleet):
  ```yaml
  - cron: '0 0 * * *'
  - cron: '15,30,45 0 * * *'
  - cron: '0,15,30,45 1 * * *'
  ```
- [ ] **Step 3:** Add comment: when onboarding tenant with new schedule, add matching cron line (max 5 per workflow)
- [ ] **Step 4:** Update README — describe window-based scheduling and 1-hour retry band
- [ ] **Step 5:** Run `node scripts/test-workflow-references.mjs` → exit 0
- [ ] **Step 6:** Commit: `ci: reduce scheduled backup polling to schedule windows`

---

## Task 4: Skip idle jobs and merge dashboard

**Files:** `.github/workflows/scheduled-backup.yml`, `.github/workflows/dashboard.yml`

- [ ] **Step 1:** Add workflow-level concurrency:
  ```yaml
  concurrency:
    group: scheduled-backup-${{ github.ref }}
    cancel-in-progress: true
  ```
- [ ] **Step 2:** Change summary job: `if: ${{ needs.prepare-matrix.outputs.count != '0' }}`
- [ ] **Step 3:** Add prepare-matrix step logging when count=0
- [ ] **Step 4:** In summary job, after report generation, add:
  ```yaml
  - run: node scripts/generate-dashboard.mjs > DASHBOARD.md
  - uses: actions/upload-artifact@v4
    with:
      name: backup-dashboard-${{ github.run_id }}
      path: DASHBOARD.md
  ```
- [ ] **Step 5:** Remove `workflow_run` trigger from `dashboard.yml`
- [ ] **Step 6:** Run `node scripts/test-generate-dashboard.mjs` → exit 0
- [ ] **Step 7:** Run `node scripts/test-workflow-references.mjs` → exit 0
- [ ] **Step 8:** Commit: `ci: skip idle summary and inline dashboard generation`

---

## Task 5: npm cache and backup timeout

**Files:** `.github/workflows/scheduled-backup.yml`, `backup.yml`, `drift-detection.yml`

- [ ] **Step 1:** Add to each setup-node before `npm ci`:
  ```yaml
  cache: 'npm'
  ```
- [ ] **Step 2:** Add `timeout-minutes: 15` to backup/detect-drift jobs
- [ ] **Step 3:** Confirm `test -f package-lock.json`
- [ ] **Step 4:** Run `node scripts/test-workflow-references.mjs` → exit 0
- [ ] **Step 5:** Commit: `ci: cache npm deps and timeout backup jobs`

---

## Task 6: Documentation and changelog

- [ ] **Step 1:** Final README pass — cron behavior, dashboard artifact, manual dispatch unchanged
- [ ] **Step 2:** Update CHANGELOG.md with user-visible CI changes
- [ ] **Step 3:** Commit: `docs: document optimized scheduled backup cadence`

---

## Post-deploy verification

After merge to `main`, monitor for 24 hours:

```bash
gh run list --workflow="Scheduled ISC Backup Matrix" --limit 20
```

**Expected:**
- ≤10 scheduled runs/day (8 cron + occasional manual)
- No healthy tenant in matrix outside 00:00–01:59 UTC window
- Total run duration <3 min when matrix empty (should not occur — no trigger outside window)
- Actions minutes drop >80% vs prior week

**Reference specs:**
- `openspec/changes/optimize-github-actions-minutes/specs/backup-pending-check/spec.md`
- `openspec/changes/optimize-github-actions-minutes/specs/scheduled-backup/spec.md`
- `openspec/changes/optimize-github-actions-minutes/specs/per-tenant-schedule/spec.md`
- `openspec/changes/optimize-github-actions-minutes/specs/dashboard-generation/spec.md`

**Reference advisor plans (optional detail):** `plans/001` through `plans/005` in repo root.
