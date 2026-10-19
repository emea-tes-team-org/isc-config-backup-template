# Dashboard Unhealthy on Backup Failure Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Show `⚠️ Backup failed` in the operations dashboard State column when a tenant's latest backup attempt status is `failed`, while keeping successful `backed-up` / `unchanged` attempts Healthy.

**Architecture:** Export attempt-status loaders from `generate-report.mjs`; pass a tenant→status map into `generateDashboard()`; wire matrix JSON through `scheduled-backup.yml` summary job; fall back to latest committed report for local README regen.

**Tech Stack:** Node.js ES modules, GitHub Actions, markdown report parsing

**Canonical test commands:** `node scripts/test-generate-report.mjs`, `node scripts/test-generate-dashboard.mjs`, `node scripts/test-generate-readme.mjs`

---

## Task 1: Attempt status helpers

**Files:**
- Modify: `scripts/generate-report.mjs`
- Modify: `scripts/test-generate-report.mjs`

**Requirements:** design D5; specs `dashboard-generation` — attempt status input

### Step 1: Write failing tests for JSON → status map

```javascript
const statuses = loadAttemptStatusesFromResults('[{"tenant":"ksb","status":"failed"}]');
assert(statuses.get("ksb") === "failed");
```

Run: `node scripts/test-generate-report.mjs` — expect FAIL

### Step 2: Implement `loadAttemptStatusesFromResults`

Use existing `normalizeResults()`; build `Map` keyed by `result.tenant`.

### Step 3: Write failing test for report markdown parsing

Fixture markdown row: `| ksb | failed | ... |` → map entry `ksb → failed`.

### Step 4: Implement `parseAttemptStatusesFromReport`

Parse table rows between header and footer; read Tenant and Status columns (index 0 and 1 after split).

Run: `node scripts/test-generate-report.mjs` — expect PASS

---

## Task 2: Dashboard state logic

**Files:**
- Modify: `scripts/generate-dashboard.mjs`
- Modify: `scripts/test-generate-dashboard.mjs`

**Requirements:** design D1, D2, D6, D7; specs `dashboard-generation`

### Step 1: Write failing test — failed attempt not healthy

```javascript
const registry = { tenants: [{ name: "ksb", active: true }] };
const markdown = generateDashboard(
  registry,
  makeGitFunctions({ lastCommit: "2026-08-13", objectCount: 264 }),
  new Date(),
  { attemptStatuses: { ksb: "failed" } }
);
assert(markdown.includes("⚠️ Backup failed"));
assert(!markdown.includes("✅ Healthy"));
```

Run: `node scripts/test-generate-dashboard.mjs` — expect FAIL

### Step 2: Extend `formatTenantState`

After inactive / no-backup / empty checks, if `attemptStatus === "failed"` return `⚠️ Backup failed`.

### Step 3: Thread `attemptStatuses` through render path

`generateDashboard(options)` → `renderTenantRow(..., attemptStatuses)` → `formatTenantState(..., attemptStatuses?.[tenant.name])`.

### Step 4: Add unchanged/success and fallback tests

Run: `node scripts/test-generate-dashboard.mjs` — expect PASS

---

## Task 3: README generation wiring

**Files:**
- Modify: `scripts/generate-readme.mjs`
- Modify: `scripts/test-generate-readme.mjs`

**Requirements:** design D3, D4

### Step 1: Resolve statuses in `generateOpsDashboardSection`

```javascript
function resolveAttemptStatuses(options = {}) {
  if (options.attemptStatuses) return options.attemptStatuses;
  if (process.env.BACKUP_RESULTS) return loadAttemptStatusesFromResults(process.env.BACKUP_RESULTS);
  const reportPath = findLatestReport();
  if (reportPath) return parseAttemptStatusesFromReport(readFileSync(join(root, reportPath), "utf8"));
  return {};
}
```

Pass to `generateDashboard(..., { attemptStatuses: resolveAttemptStatuses(options) })`.

### Step 2: Add CLI `--results` flag (optional, mirrors env)

### Step 3: Tests for env and report fallback

Run: `node scripts/test-generate-readme.mjs` — expect PASS

---

## Task 4: Workflow pass-through

**Files:**
- Modify: `.github/workflows/scheduled-backup.yml`

**Requirements:** specs `reporting-observability`; design D3

### Step 1: Before README generation in summary job

```yaml
- name: Generate README and tenant shortcuts
  env:
    BACKUP_RESULTS: ${{ steps.summary.outputs.results_json }}
  run: node scripts/generate-readme.mjs README.md
```

Add a prior step output that sets `results_json` from merged `backup-results/*.json` (same jq merge as report generation).

### Step 2: Verify workflow still commits README + report

Run: `node scripts/test-workflow-references.mjs` if applicable

---

## Task 5: Changelog

**Files:**
- Modify: `CHANGELOG.md`

Note: Dashboard State now shows `⚠️ Backup failed` when latest matrix attempt failed.

---

## Verification checklist

- [ ] Failed matrix attempt → README State `⚠️ Backup failed`, Last unchanged
- [ ] Successful unchanged attempt → State `Healthy`
- [ ] No status data → prior git-only behavior
- [ ] Inactive tenant → `❌`
- [ ] All three test scripts pass
