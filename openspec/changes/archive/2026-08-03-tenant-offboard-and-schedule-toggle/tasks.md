## 1. Schedule Toggle Script

- [x] 1.1 Create `scripts/schedule-toggle.mjs` that loads registry, finds tenant, flips `active`, assigns default schedule `"0 0 * * *"` when re-enabling without schedule, and saves `tenants.yaml`
- [x] 1.2 Add `--push` flag (or env `PUSH=1`) for workflow use to commit and push `tenants.yaml` on `main` with pull/rebase retry
- [x] 1.3 Export core toggle logic for unit testing without git side effects

## 2. Offboard Script

- [x] 2.1 Create `scripts/offboard.mjs` that validates tenant exists, removes registry entry, and saves `tenants.yaml`
- [x] 2.2 Implement tag deletion: list remote tags matching `<tenant>/*` and delete each via `git push origin :refs/tags/<tag>`
- [x] 2.3 Implement branch squash: checkout tenant branch, orphan commit with HEAD tree, force-push, update `.tenant.yaml` `active: false`
- [x] 2.4 Add confirmation prompt for CLI (skip when `--yes` or env `CONFIRM=<tenant>` for Actions)
- [x] 2.5 Export offboard steps for unit testing (registry removal, tag list filter, squash tree preservation)

## 3. CLI Integration

- [x] 3.1 Add `schedule-toggle` and `offboard` routes to `scripts/cli.mjs` COMMANDS map and help text
- [x] 3.2 Deprecate `onboard --remove` help text pointing to `offboard`

## 4. GitHub Actions Workflows

- [x] 4.1 Create `.github/workflows/schedule-toggle.yml` with `tenant_name` input, main-only guard, checkout, `node scripts/cli.mjs schedule-toggle <tenant> --push`
- [x] 4.2 Create `.github/workflows/offboard.yml` with `tenant_name` and `confirm_tenant_name` inputs, main-only guard, full history checkout, `node scripts/cli.mjs offboard <tenant> --yes`
- [x] 4.3 Set `permissions: contents: write` on both workflows

## 5. Automated Tests

- [x] 5.1 Create `scripts/test-schedule-toggle.mjs` covering: toggle off, toggle on, default schedule on re-enable, unknown tenant error, tags/branch unchanged (mocked)
- [x] 5.2 Create `scripts/test-offboard.mjs` covering: registry removal, tag filter, squash preserves tree, confirmation mismatch, unknown tenant error
- [x] 5.3 Update `scripts/test-workflow-references.mjs` to assert new workflow files exist and reference `cli.mjs`
- [x] 5.4 Map scenarios: Schedule toggle via GitHub Actions (4.1), Toggle preserves branch and tags (5.1), Schedule toggle CLI parity (3.1, 5.1)
- [x] 5.5 Map scenarios: Offboard via GitHub Actions (4.2), tag deletion (5.2), branch squash (5.2), branch preserved (5.2), confirmation mismatch (5.2), Offboard CLI parity (3.1, 5.2)
- [x] 5.6 Map scenarios: CLI routes (3.1), platform-integration workflow CLI invocation (4.1, 4.2), registry matrix exclusion (5.1, 5.2), tenant-lifecycle restore target rejection (document in test or restore validation test)

## 6. Documentation

- [x] 6.1 Update README: add ISC Schedule Toggle and ISC Offboard workflow sections with inputs and behavior
- [x] 6.2 Update README tenant management section: replace manual `active: false` guidance with Schedule Toggle; replace `onboard --remove` with `offboard`
- [x] 6.3 Update `scripts/cli.mjs` and script header comments with new commands and examples

## 7. Changelog

- [x] 7.1 Create or update changelog entry for Schedule Toggle and Offboard capabilities
- [x] 7.2 Confirm entry covers user-visible GitHub Actions and CLI changes from proposal Capabilities
