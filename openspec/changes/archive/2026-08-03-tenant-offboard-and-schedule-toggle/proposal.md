# Proposal: Tenant Offboard and Schedule Toggle

## Why

Onboarding tenants is fully automated via GitHub Actions, but pausing daily backups or decommissioning a tenant still requires manual `tenants.yaml` edits or a local CLI `--remove` that does not push to `main`, delete backup tags, or collapse branch history. As tenant count grows, backup tags accumulate on the Tags tab and branch histories grow large. Operators need two clear GitHub UI actions: a reversible schedule toggle to pause/resume daily backups, and an offboard action to stop backups, remove registry presence, delete all tenant backup tags, and retain only the latest snapshot as a single commit on the tenant branch.

## What Changes

- **New workflow: ISC Schedule Toggle** — `workflow_dispatch` on `main` with a single `tenant_name` input; flips `active` in `tenants.yaml` and pushes to `main`
- **New workflow: ISC Offboard** — `workflow_dispatch` on `main` with `tenant_name` (and confirmation); removes tenant from `tenants.yaml`, deletes all git tags matching `<tenant>/*`, squashes the tenant branch to one commit preserving the latest backup tree, sets `active: false` in `.tenant.yaml` on the branch
- **New scripts** — `scripts/schedule-toggle.mjs` and `scripts/offboard.mjs` with shared registry update logic; CLI routes via `scripts/cli.mjs`
- **Registry toggle semantics** — `active: true → false` removes tenant from scheduled backup matrix; `active: false → true` re-enables with default schedule `"0 0 * * *"` when missing
- **Offboard preserves** — tenant git branch, latest `backups/<tenant>/` data, GitHub Environment and secrets (not deleted in v1)
- **Deprecate partial remove** — `onboard --remove` superseded by offboard CLI mirror with full cleanup
- **README** — document both workflows and CLI equivalents

## Capabilities

### New Capabilities

- `tenant-schedule-toggle`: GitHub Actions workflow and CLI command that flips a tenant's `active` flag in `tenants.yaml` based on current state, without modifying branch history or backup tags
- `tenant-offboarding`: GitHub Actions workflow and CLI command that decommissions a tenant by removing the registry entry, deleting all backup tags, and squashing the tenant branch to a single snapshot commit

### Modified Capabilities

- `cli-alignment`: add `schedule-toggle` and `offboard` commands routed through `scripts/cli.mjs`
- `platform-integration`: add two new `workflow_dispatch` workflows on `main` mirroring CLI behavior
- `tenant-registry`: schedule toggle becomes the supported operator path for changing `active` without manual YAML edits
- `tenant-lifecycle`: offboarding completes the lifecycle alongside onboarding; branch preserved as archival snapshot

## Impact

- **New files:** `.github/workflows/schedule-toggle.yml`, `.github/workflows/offboard.yml`, `scripts/schedule-toggle.mjs`, `scripts/offboard.mjs`, `scripts/test-schedule-toggle.mjs`, `scripts/test-offboard.mjs`
- **Modified files:** `scripts/cli.mjs`, `scripts/onboard.mjs` (deprecation note for `--remove`), `README.md`
- **GitHub UI:** two new Actions under workflow_dispatch; Schedule Toggle input: `tenant_name`; Offboard input: `tenant_name` plus typed confirmation
- **Git operations:** offboard requires force-push on tenant branch and bulk tag deletion (`git push origin :refs/tags/<tag>`)
- **Permissions:** workflows need `contents: write`; offboard may require bypass of branch protection on tenant branches
- **No breaking changes** to scheduled-backup, backup, restore, or onboarding workflows; offboarded tenants excluded from dashboard matrix and restore-as-target validation
