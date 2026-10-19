## Context

The operations UX refactor consolidated 14 workflows into six, but **ISC Lifecycle** still bundles onboard, verify, schedule-toggle, and offboard behind one `operation` dropdown with ten inputs. GitHub `workflow_dispatch` shows all inputs unconditionally.

A partial mitigation exists: `generate-tenant-shortcuts.mjs` emits zero-input wrappers for backup and toggle that dispatch consolidated workflows via `actions/github-script`. Offboard README links still point at the lifecycle mega-form.

Operators prefer tenant-scoped actions as dedicated workflows (tenant baked in) and want action links in the fleet status table rather than a duplicate shortcuts section.

Constraints:
- GitHub dispatch URLs cannot prefill inputs — wrappers are the correct pattern
- `isc-lifecycle.yml` remains the implementation for verify, toggle, and offboard jobs
- CLI parity unchanged (ADR-0003)
- Wrapper workflow files are generated from `tenants.yaml` on README regeneration

## Goals / Non-Goals

**Goals:**
- Generate per-tenant wrappers for backup, toggle, verify, and offboard
- Add Actions column to fleet table with inline dispatch links
- Offboard wrapper: single mandatory `confirm` input must equal `offboard`
- Remove duplicate Per-tenant shortcuts section from generated README
- Preserve existing lifecycle job logic via dispatch, not duplication

**Non-Goals:**
- Splitting `isc-lifecycle.yml` into separate implementation workflows
- Dedicated `isc-onboard.yml` (may follow later)
- Per-tenant wrappers for restore or config-tools (cross-tenant or sub-operation complexity)
- HTML `<details>` dropdowns or GitHub Pages for richer UI

## Decisions

### D1: Extend dispatch-wrapper pattern for verify and offboard

- **Choice:** Generate `isc-verify-{tenant}.yml` and `isc-offboard-{tenant}.yml` alongside existing backup/toggle wrappers
- **Reason:** Proven pattern; zero/minimal inputs; no job logic duplication
- **Considered alternatives:** Split lifecycle into four workflows — rejected as larger scope with duplicate job definitions

### D2: Offboard confirmation via keyword `offboard`

- **Choice:** Offboard wrapper exposes one string input `confirm`; validate job fails unless value is exactly `offboard`; dispatch sets `confirm_tenant` equal to tenant automatically
- **Reason:** Operator confirmed destructive intent without re-typing tenant name; lifecycle internal check still satisfied
- **Considered alternatives:** Expose `confirm_tenant` to user — rejected as redundant when tenant is in workflow title

### D3: Verify wrapper with zero inputs

- **Choice:** `isc-verify-{tenant}.yml` dispatches verify with `run_backup: false` fixed
- **Reason:** Matches common verify use case; avoids any form fields
- **Considered alternatives:** Optional `run_backup` boolean — deferred; can add later without breaking zero-input default

### D4: Actions column in fleet table

- **Choice:** `generate-dashboard.mjs` adds Actions column with markdown links: `[Backup] · [Toggle] · [Verify] · [Offboard]`
- **Reason:** Single surface for status + actions; GitHub markdown supports inline links natively
- **Considered alternatives:** `<details>` collapsible — rejected; extra click for high-frequency ops

### D5: Dashboard generator accepts repo slug for URL building

- **Choice:** Pass `repoSlug` option into `generateDashboard()` / `renderTenantRow()` using existing `workflowDispatchUrl()` helper
- **Reason:** Dashboard module owns fleet table; readme generator already resolves repo slug
- **Considered alternatives:** Keep URL building only in readme — rejected; splits table rendering across modules awkwardly

### D6: Remove Per-tenant shortcuts subsection

- **Choice:** Delete shortcuts table from `generateOpsDashboardSection()`; Quick Actions retains fleet-level workflows only
- **Reason:** Eliminates duplication once Actions column exists
- **Considered alternatives:** Keep both — rejected per operator preference

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Workflow file proliferation (~4 × N tenants) | Files are generated; clear naming; regenerate on registry change |
| Wide README table on mobile | Short link labels; middot separators wrap naturally |
| Operator bypasses wrapper and uses lifecycle directly | Lifecycle form unchanged; README de-emphasizes it |
| Offboard keyword weaker than tenant-name confirm | Wrapper name includes tenant; keyword confirms destructive class of action |

## Migration Plan

1. Extend `generate-tenant-shortcuts.mjs` with verify and offboard wrapper templates
2. Update `generate-dashboard.mjs` to render Actions column when `repoSlug` provided
3. Update `generate-readme.mjs` to pass repo slug, remove shortcuts subsection
4. Regenerate README and shortcut workflows via `node scripts/generate-readme.mjs`
5. Run test suite for dashboard, readme, and shortcuts generators
6. No tenant branch or registry migration required

Rollback: revert generator scripts and regenerate README/workflows from previous commit.

## Open Questions

- Whether to add optional `run_backup` on verify wrapper in a follow-up
- Whether to add dedicated `isc-onboard.yml` to remove operation picker for rare onboard runs
