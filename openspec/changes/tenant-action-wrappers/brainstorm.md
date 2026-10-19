# Tenant Action Wrappers — Design Session

Raw capture from explore mode 2026-08-12. Decision chain from operator UX discussion.

## Context

Operators dislike **ISC Lifecycle** (`isc-lifecycle.yml`) because GitHub `workflow_dispatch` cannot hide inputs by operation. Running schedule-toggle, verify, or offboard still shows onboard credential fields, `confirm_tenant`, and `run_backup` — most fields are irrelevant for the chosen operation.

Partial mitigation already exists: **per-tenant shortcut workflows** for backup and schedule-toggle (`isc-backup-{tenant}.yml`, `isc-toggle-{tenant}.yml`) dispatch consolidated workflows with tenant baked in and zero UI inputs. Offboard still links to the mega-form with manual operation + tenant selection. Verify has no shortcut.

The README separates fleet status (Tenant Overview table) from a duplicate **Per-tenant shortcuts** table below Quick Actions.

## Decision Chain

| Q | Decision |
|---|----------|
| Q1 | Prefer **thin wrappers per tenant** for tenant-scoped actions over passing `tenant` as a workflow parameter |
| Q2 | **Embed action links in the fleet table** (Actions column) instead of a separate shortcuts section |
| Q3 | **Offboard confirmation** via mandatory string input: operator must type `offboard` (not re-type tenant name) |
| Q4 | Offboard wrapper validates `confirm === "offboard"`, then dispatches `isc-lifecycle.yml` with `operation=offboard`, `tenant`, and `confirm_tenant` auto-set to match |
| Q5 | Extend generated wrappers: **backup** (exists), **toggle** (exists), **verify** (new), **offboard** (new) |
| Q6 | Verify wrapper: zero inputs by default; optional `run_backup` boolean acceptable |
| Q7 | **Inline markdown links** for Actions column (`[Backup] · [Toggle] · [Verify] · [Offboard]`) — GitHub README cannot do functional URL dropdowns |
| Q8 | Remove **Per-tenant shortcuts** subsection from generated README; Quick Actions retains fleet-level workflows only |
| Q9 | Keep `isc-lifecycle.yml` as **implementation target** for verify/toggle/offboard dispatches (no job logic duplication) |
| Q10 | Onboard remains a dedicated form — optional follow-up: `isc-onboard.yml` without operation picker (out of scope unless needed) |
| Q11 | `generate-tenant-shortcuts.mjs` and `generate-dashboard.mjs` are the primary touchpoints; README generation passes repo slug into dashboard for action URLs |

## Approaches Considered

### A. Split lifecycle into four separate workflows (rejected for this change)

Clean forms in Actions sidebar but increases card count and duplicates job definitions unless reusable workflows are introduced.

### B. Thin wrappers everywhere (selected)

Extend existing dispatch-wrapper pattern. Implementation stays in consolidated workflows; operator UX is one-click or minimal-input per tenant.

### C. README-only deep links (rejected)

GitHub dispatch URLs cannot prefill inputs; wrappers already solve this.

## Trade-offs Accepted

- **~4 generated workflow files per tenant** (backup, toggle, verify, offboard) — acceptable; files are generated and named clearly (`ISC Offboard — fernando`)
- **Actions column widens README table** — acceptable; links wrap on narrow viewports
- **Offboard uses keyword confirm not tenant-name replay** — simpler UX; wrapper still satisfies lifecycle's internal `confirm_tenant === tenant` check
- **isc-lifecycle.yml remains in sidebar** — README de-emphasizes it; onboard may get dedicated workflow later

## Target UX

```
| Tenant | … | Status | Actions |
| fernando | … | ✅ Healthy | [Backup] · [Toggle] · [Verify] · [Offboard] |
```

Offboard link → `isc-offboard-fernando.yml` → single input: type `offboard` → dispatches lifecycle offboard.
