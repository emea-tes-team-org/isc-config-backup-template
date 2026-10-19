## 1. Offboard tag pruning logic

- [x] 1.1 Add `selectLatestTenantTag(tags, tenant)` using `parseTagTimestamp` from `parse-tenants.mjs` (max embedded timestamp; lexicographic tie-break)
- [x] 1.2 Add `tagsToDeleteOnOffboard(tags, tenant)` returning all `<tenant>/*` tags except the selected latest valid backup tag; invalid timestamp tags included in delete set
- [x] 1.3 Add `pruneTenantTagsOnOffboard(tenant, allTags, deleteTagFn, releaseDeleteFn)` returning `{ kept, deleted }`; skip when no tenant tags
- [x] 1.4 Wire `offboardTenant()` to call prune helper instead of `deleteMatchingTags()`; log kept tag and deleted count
- [x] 1.5 Reuse or extract `deleteReleaseForTag` from `prune-tags.mjs` for pruned tags only (non-fatal on failure)

## 2. Tests

- [x] 2.1 Update `scripts/test-offboard.mjs`: `selectLatestTenantTag` picks newest by timestamp
- [x] 2.2 Add test: `tagsToDeleteOnOffboard` keeps latest, deletes older tags
- [x] 2.3 Add test: single tag → empty delete set; zero tags → no-op
- [x] 2.4 Add test: invalid `<tenant>/foo` tags deleted; not kept when no valid backup tag
- [x] 2.5 Add test: `pruneTenantTagsOnOffboard` invokes release delete for deleted tags only
- [x] 2.6 Run `node scripts/test-offboard.mjs` and confirm all pass

## 3. Documentation

- [x] 3.1 Update README offboard section: retain latest backup tag; delete older tags and their releases
- [x] 3.2 Update `scripts/offboard.mjs` header comment to describe latest-tag retention

## 4. Documentation (mandatory)

- [x] 4.1 Update README tenant management / offboard section for user-visible tag behavior change
- [x] 4.2 Confirm no workflow YAML or CLI help text changes required beyond script behavior
- [x] 4.3 Update inline docs in `offboard.mjs` exported helpers (JSDoc)

## 5. Changelog

- [x] 5.1 Create or update changelog entry for this change
- [x] 5.2 Confirm entry covers latest-tag retention on offboard (user-visible)
