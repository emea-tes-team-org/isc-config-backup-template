# Proposal: Keep Latest Tag When Offboarding a Tenant

## Why

Offboard today deletes every backup tag for the tenant, including the most recent restore-point tag. Operators lose the named audit reference on the GitHub Tags tab and any GitHub Release tied to that tag, even though offboard already preserves the tenant branch as a squashed snapshot. Keeping the single latest backup tag gives a clear "last known good backup" pointer for archival restore and operator visibility without retaining a full tag history on decommissioned tenants.

## What Changes

- **Offboard tag pruning** — `scripts/offboard.mjs` SHALL delete all tenant backup tags except the one with the greatest name-embedded UTC timestamp (same parsing as tag retention and pending checks)
- **Release cleanup** — when offboard deletes stale tags, it SHALL also delete GitHub Releases for those tags; the release on the kept latest tag (if any) remains
- **Tests** — extend `scripts/test-offboard.mjs` for latest-tag retention, single-tag no-op, zero-tag skip, and release deletion for pruned tags
- **README** — update offboard documentation to describe latest-tag retention instead of full tag deletion

**Offboard tag behavior**
- From: all git tags matching `<tenant>/*` are deleted on offboard
- To: all matching tags except the latest backup tag (by embedded timestamp) are deleted; zero tags unchanged
- Reason: preserve restore-point reference without leaving full tag history
- Impact: non-breaking for registry, branch squash, and schedule exclusion; operators see one tag remain per offboarded tenant

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `tenant-offboarding`: offboard SHALL retain the latest backup tag and delete only older tenant tags (plus releases for deleted tags)
- `tenant-lifecycle`: offboard workflow scenario SHALL reflect partial tag cleanup, not full deletion
- `platform-integration`: offboard CLI/workflow parity SHALL describe latest-tag retention semantics
- `cli-alignment`: offboard CLI reporting SHALL reflect kept vs deleted tags

## Impact

- **Modified files:** `scripts/offboard.mjs`, `scripts/test-offboard.mjs`, `README.md`
- **Optional reuse:** `parseTagTimestamp` from `scripts/parse-tenants.mjs`; release delete helper from `scripts/prune-tags.mjs` (extract or import)
- **GitHub UI:** Tags tab shows one `<tenant>/YYYY-MM-DD_HH-MM-SS` tag after offboard when tags existed; Releases for pruned tags removed
- **Workflows:** `.github/workflows/offboard.yml` unchanged (delegates to CLI/script)
- **No change:** registry removal, branch squash, environment preservation, scheduled-backup exclusion, restore-as-target validation
