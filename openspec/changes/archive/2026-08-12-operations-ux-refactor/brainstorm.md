# Operations UX Refactor — Design Session (Grill-with-docs)

Raw capture from grilling session 2026-08-12. Decision chain Q1–Q20.

## Context

Operator lost track of app shape and UX. 14 GitHub Actions workflows, fragmented docs, branch-per-tenant model carrying main artifacts (workflow sync), nested `backups/<tenant>/` redundant with branch identity.

## Decision Chain

### Round 1 — Strategic roots

| Q | Decision |
|---|----------|
| Q1 | Mixed operators; **GitHub Actions primary**, CLI mirrors same operations |
| Q2 | Pain: too many workflows, lost architecture, weak observability, confusing restore/tokenization; **main = app, branches = data only** |
| Q3 | Success: self-service ops, fleet dashboard, specs match reality, fewer moving parts |
| Q4 | Keep branch-per-tenant; simplify (data-only branches) |
| Q5 | CLI-aligned Actions + dashboard; nothing deployed outside GitHub |

### Round 2 — Architecture shape

| Q | Decision |
|---|----------|
| Q6 | Delete `sync-workflows.yml`; one-time cleanup removes `.github/workflows/` from tenant branches |
| Q7 | Consolidate to useful workflows; rename **Scheduled ISC Backup Matrix** → **Scheduled Backup** |
| Q8 | Committed operator hub (later promoted to README) |
| Q9 | Tenant branch allowlist: flat `backups/`, `.tenant.yaml`, `.gitignore`, optional `templates/`, `vars/` |
| Q10 | Restore from `main` with explicit `source_ref` input |
| Q11 | Tokenize inside lifecycle/config workflow family |

### Round 3 — Migration & specs

| Q | Decision |
|---|----------|
| Q12 | Big-bang migration to flat `backups/` on tenant branches |
| Q13 | Journey-based spec consolidation (~6 capability specs) |
| Q14 | Update glossary for human-chosen tenant names + `hostname`; do not rename fleet branches now |
| Q15 | Priority: sync kill → hub → workflow consolidation → restore redesign → flat path → specs |

### Round 4 — UX mechanics

| Q | Decision |
|---|----------|
| Q16 | **6 focused workflows** (not 1 mega-workflow) — GitHub cannot hide dispatch inputs by operation; README dispatch deep-links compensate |
| Q17 | Full hub content; **README.md = generated operations landing**; technical docs in `docs/` |
| Q18 | Entire README generated from `README.template.md` + generator |
| Q19 | Flat `backups/` aligns with original Config Hub design (see proposal) |
| Q20 | **Confirmed north star** |

## Target workflow roster (6 cards)

1. **ISC Lifecycle** — onboard, verify, schedule-toggle, offboard
2. **ISC Backup** — manual single-tenant backup
3. **ISC Restore** — source_ref, target_tenant, mode, vars_file (always from main)
4. **ISC Config Tools** — tokenize (sub-ops), drift-detection
5. **Scheduled Backup** — cron matrix (renamed)
6. **ISC Maintenance** — prune tags, cleanup deployments

## Trade-offs accepted

- Big-bang flat backup path migration (6 tenants) vs dual-read complexity
- 6 workflow cards vs 1 mega-form (GitHub UI constraint)
- README fully generated (B) vs marker block only — operator edits go in template
- Glossary update without fleet rename — `environment` override remains for legacy names

## Git history note (Q19)

Initial commit (7510e71): single-branch repo, `BACKUP_DIR = join("backups", TENANT_NAME)` where TENANT_NAME = URL subdomain. Config Hub docs always specified **Backups Path: `backups`**. Nested subfolder made sense on single-branch multi-tenant-on-main; redundant after branch-per-tenant. Flat `backups/TYPE/` on tenant branch restores original Config Hub contract.
