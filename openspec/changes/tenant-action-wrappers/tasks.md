## 1. Tenant shortcut workflow generation

- [x] 1.1 Add `dispatchWrapperWithConfirm()` helper in `generate-tenant-shortcuts.mjs` for offboard (validate `confirm === "offboard"` job before dispatch)
- [x] 1.2 Generate `isc-verify-{tenant}.yml` dispatching lifecycle verify with zero inputs (covers: Verify wrapper dispatches lifecycle verify)
- [x] 1.3 Generate `isc-offboard-{tenant}.yml` with single `confirm` input and keyword validation (covers: Offboard wrapper validates keyword confirm, Offboard wrapper dispatches lifecycle offboard)
- [x] 1.4 Extend `tenantShortcutWorkflowFile()` with `verify` and `offboard` kinds; update cleanup regex for generated verify/offboard files
- [x] 1.5 Update `test-generate-tenant-shortcuts.mjs` for verify/offboard file generation, dispatch targets, and confirm validation script content

## 2. Fleet table Actions column

- [x] 2.1 Add optional `repoSlug` to `generateDashboard()` options; pass through to `renderTenantRow()`
- [x] 2.2 Render Actions column with Backup · Toggle · Verify · Offboard links when `repoSlug` provided (covers: Fleet row lists all tenant actions, Action links use wrapper workflows)
- [x] 2.3 Import `workflowDispatchUrl` and `tenantShortcutWorkflowFile` from `generate-tenant-shortcuts.mjs` (or shared export)
- [x] 2.4 Update `test-generate-dashboard.mjs` for Actions column presence and correct workflow URLs (covers: Operator triggers backup/verify/offboard from fleet table)

## 3. README generation cleanup

- [x] 3.1 Pass `repoSlug` into `generateDashboard()` from `generateOpsDashboardSection()`
- [x] 3.2 Remove Per-tenant shortcuts subsection from `generate-readme.mjs` (covers: Separate per-tenant shortcuts table removed)
- [x] 3.3 Update `test-generate-readme.mjs` to assert Actions column in fleet table and absence of shortcuts subsection

## 4. Regenerate committed artifacts

- [x] 4.1 Run `node scripts/generate-readme.mjs` to regenerate README and all shortcut workflow files
- [x] 4.2 Verify generated offboard wrappers expose confirm input with `offboard` description text

## 5. Documentation

- [x] 5.1 Regenerated README serves as operator doc — no manual README.template.md edit expected (mark done if generate-only)
- [x] 5.2 Update `docs/setup.md` if it references Per-tenant shortcuts table or lifecycle offboard confirmation by tenant name
- [x] 5.3 N/A — no CLI contract changes; inline JSDoc only if new exported helpers need it

## 6. Changelog

- [x] 6.1 Create or update CHANGELOG entry via changelog-generator for tenant action wrappers and fleet table Actions column
- [x] 6.2 Confirm entry covers operations-dashboard and tenant-lifecycle user-visible changes
