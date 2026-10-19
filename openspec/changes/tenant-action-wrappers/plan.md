# Tenant Action Wrappers Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Complete per-tenant wrapper workflows for verify and offboard, embed action links in the fleet table, and remove the duplicate shortcuts section from generated README.

**Architecture:** Extend the existing dispatch-wrapper pattern in `generate-tenant-shortcuts.mjs`. Offboard wrappers add a validate job for `confirm === "offboard"` before dispatching `isc-lifecycle.yml`. Dashboard generator accepts `repoSlug` to build Actions column URLs. README generator passes repo slug and drops the shortcuts subsection.

**Tech Stack:** Node.js 20 ESM, GitHub Actions workflow_dispatch, actions/github-script

**Canonical test commands:**
```bash
node scripts/test-generate-tenant-shortcuts.mjs
node scripts/test-generate-dashboard.mjs
node scripts/test-generate-readme.mjs
```

**References:** `design.md`, `specs/operations-dashboard/spec.md`, `specs/tenant-lifecycle/spec.md`

---

## Task 1: Offboard wrapper with confirm validation

**Files:** `scripts/generate-tenant-shortcuts.mjs`, `scripts/test-generate-tenant-shortcuts.mjs`

- [ ] **Step 1:** Write failing test — offboard shortcut YAML contains `confirm` input and validate step checking `offboard`
- [ ] **Step 2:** Add `offboardDispatchWrapper({ tenant })` function with validate + dispatch jobs
- [ ] **Step 3:** Run `node scripts/test-generate-tenant-shortcuts.mjs` — expect PASS

**Dispatch payload after validation:**
```javascript
{ operation: "offboard", tenant, confirm_tenant: tenant }
```

---

## Task 2: Verify wrapper (zero inputs)

**Files:** `scripts/generate-tenant-shortcuts.mjs`, `scripts/test-generate-tenant-shortcuts.mjs`

- [ ] **Step 1:** Write failing test — `isc-verify-fernando.yml` dispatches lifecycle with `operation=verify`
- [ ] **Step 2:** Add verify wrapper generation in tenant loop; extend `tenantShortcutWorkflowFile(name, "verify")`
- [ ] **Step 3:** Extend cleanup regex to remove old `isc-verify-*.yml` and `isc-offboard-*.yml` on regen
- [ ] **Step 4:** Run tests — expect PASS

---

## Task 3: Fleet table Actions column

**Files:** `scripts/generate-dashboard.mjs`, `scripts/test-generate-dashboard.mjs`

- [ ] **Step 1:** Write failing test — dashboard with `repoSlug: "org/repo"` includes Actions column and offboard URL
- [ ] **Step 2:** Update table header to add Actions when `repoSlug` set
- [ ] **Step 3:** Implement `formatTenantActions(tenant, repoSlug)` returning markdown link string
- [ ] **Step 4:** Run `node scripts/test-generate-dashboard.mjs` — expect PASS

**Link format:**
```
[Backup](url) · [Toggle](url) · [Verify](url) · [Offboard](url)
```

---

## Task 4: README generator integration

**Files:** `scripts/generate-readme.mjs`, `scripts/test-generate-readme.mjs`

- [ ] **Step 1:** Write failing test — no `### Per-tenant shortcuts` heading; fleet table has Actions links
- [ ] **Step 2:** Pass `repoSlug` to `generateDashboard()` in ops section
- [ ] **Step 3:** Remove shortcuts table block (lines ~95–113)
- [ ] **Step 4:** Run `node scripts/test-generate-readme.mjs` — expect PASS

---

## Task 5: Regenerate and docs

**Files:** `README.md`, `.github/workflows/isc-verify-*.yml`, `.github/workflows/isc-offboard-*.yml`, `docs/setup.md`, `CHANGELOG.md`

- [ ] **Step 1:** Run `node scripts/generate-readme.mjs`
- [ ] **Step 2:** Review generated offboard wrappers for confirm input description
- [ ] **Step 3:** Update `docs/setup.md` if lifecycle offboard docs reference tenant-name confirm via README path
- [ ] **Step 4:** Add CHANGELOG entry
- [ ] **Step 5:** Run all three test scripts — final PASS

---

## Commit points

1. After Task 2: `feat: generate verify and offboard tenant shortcut workflows`
2. After Task 4: `feat: embed tenant actions in fleet table, remove shortcuts section`
3. After Task 5: `chore: regenerate README and workflows, update docs and changelog`
