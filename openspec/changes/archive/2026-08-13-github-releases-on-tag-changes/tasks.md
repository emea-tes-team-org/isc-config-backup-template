# Tasks: GitHub Releases Only When Tag Content Changes

## 1. Release helper content-change gate

- [x] 1.1 Add `find_previous_tenant_tag()` to `scripts/create-backup-release.sh` — list `${TENANT}/*` tags, sort by embedded UTC timestamp descending, exclude current tag
- [x] 1.2 Compare `git rev-parse "${TAG_NAME}:backups"` vs previous tag's `:backups` tree; skip release (exit 0, info log) when equal
- [x] 1.3 Move zip build and `gh release create` after comparison so unchanged runs avoid zip/API work
- [x] 1.4 Update script header comments documenting skip behavior and first-tag publish path

## 2. Automated tests (spec scenario coverage)

- [x] 2.1 Extend `scripts/test-create-backup-release.mjs` with git fixture: two tags, identical `backups/` tree — assert skip, no `gh release create`
- [x] 2.2 Test: tags with different `backups/` tree — assert release created (mock `gh`)
- [x] 2.3 Test: no previous tag — assert release created (first restore point)
- [x] 2.4 Test: release API failure still non-fatal when content changed
- [x] 2.5 Run `node scripts/test-create-backup-release.mjs`

## 3. Workflow verification

- [x] 3.1 Confirm `isc-backup.yml` and `scheduled-backup.yml` still invoke helper after tag push (no YAML change expected)
- [x] 3.2 Run `node scripts/test-workflow-references.mjs` — both workflows still reference `create-backup-release.sh`

## 4. Documentation

- [x] 4.1 Update docs/cli.md: GitHub Releases created only when backup content changed since previous restore point; tags always pushed
- [x] 4.2 N/A — no API/connector docs affected

## 5. Changelog

- [x] 5.1 Update CHANGELOG Unreleased: reverse scheduled/manual release-on-unchanged behavior; note tag-only unchanged runs
- [x] 5.2 Confirm entry covers Releases page impact from proposal Capabilities
