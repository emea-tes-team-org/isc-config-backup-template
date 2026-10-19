# Design: ISC Onboarding Update In Place

## Context

ISC Config Hub onboarding is available via GitHub Actions (`onboarding.yml`) and CLI (`scripts/onboard.mjs`). Both validate ISC credentials, provision a tenant branch, GitHub Environment secrets, branch metadata (`.tenant.yaml`, `.gitignore`), and register the tenant in `tenants.yaml` on `main`.

Offboard (v1) removes the registry entry and squashes/tags cleanup but **preserves branch and environment**. Re-onboarding was deferred: onboarding workflow duplicate checks block the natural recovery path. CLI onboarding already upserts; workflow does not.

Recent operational need: refresh empty environment secrets and re-register offboarded tenants (e.g. `mediolanum`) without local CLI.

Constraints: main-only guard; credential validation before mutations; `ADMIN_TOKEN` for environment secrets; preserve backup data on tenant branches; GitHub UI first.

## Goals / Non-Goals

**Goals:**
- Make `onboarding.yml` idempotent — create when absent, update when present
- Align workflow behavior with `onboard.mjs` upsert semantics
- Support re-onboard after offboard (branch exists, registry entry missing)
- Support secret refresh for registered tenants (registry + branch exist)
- Preserve existing `schedule`, `environment`, and backup tuning fields in `tenants.yaml`
- Report create vs update in workflow summary

**Non-Goals:**
- Changing offboard to delete environments or secrets
- Separate "update only" workflow or mode input
- Rotating secrets without re-supplying client_id/secret (no "keep existing secret" path in Actions)
- Bulk onboarding multiple tenants in one run
- Modifying backup/restore workflows

## Decisions

### D1: Single idempotent workflow (no mode toggle)

- **Choice:** Remove duplicate check; same inputs for create and update
- **Reason:** Matches CLI; reduces operator error; offboard design assumed manual re-onboard would eventually be automated
- **Considered alternatives:** `update` workflow_dispatch input — rejected per brainstorm Q1

### D2: Shared Node execution path

- **Choice:** After credential validation, workflow calls shared onboarding function (extend `onboard.mjs` with `--from-env` / workflow entry or export `setupGithubTenant` + `updateTenantRegistry` for reuse)
- **Reason:** Eliminates drift between bash workflow steps and CLI; registry merge logic already lives in `updateTenantRegistry()`
- **Considered alternatives:** Duplicate idempotent bash in YAML — rejected; caused current divergence

### D3: Branch handling when branch exists

- **Choice:** Detect remote branch via GitHub API (`branchExists`); if exists, skip branch creation and update `.tenant.yaml` / `.gitignore` via Contents API on the existing branch ref; if absent, create from `main` as today
- **Reason:** Preserves `backups/<tenant>/` history; offboard leaves squashed snapshot on branch; API updates avoid needing a local git checkout in CI
- **Considered alternatives:** Force-recreate branch from main — rejected; destructive; local `git checkout` — rejected; redundant when Contents API suffices

### D4: Environment and secrets always upserted

- **Choice:** `PUT` environment (no-op if exists); `gh secret set` overwrites `TENANT_URL`, `CLIENT_ID`, `CLIENT_SECRET`
- **Reason:** Primary use case includes secret refresh after empty environments
- **Considered alternatives:** Skip secret write if environment exists — rejected; cannot detect empty vs intentional

### D5: Registry merge preserves operator tuning

- **Choice:** Reuse `updateTenantRegistry()` merge rules from `onboard.mjs`
- **Reason:** Re-onboard after offboard should not reset custom `schedule` or `environment` overrides stored in prior registry entry (if re-adding from backup of tenants.yaml is N/A, defaults apply; if entry existed, preserve fields)

### D6: Detect create vs update for summary

- **Choice:** Before mutations, record `branch_existed` and `registry_existed` booleans; emit in `GITHUB_STEP_SUMMARY`
- **Reason:** Operator visibility without separate workflow

### D7: Workflow step simplification

- **Choice:** Replace steps 5–8 (duplicate check, create branch bash, create secrets bash, append tenants.yaml bash) with: validate → invoke onboard script → push main registry if script modified tenants.yaml locally
- **Reason:** Fewer steps; single source of truth

### D8: Tests

- **Choice:** Unit tests for registry merge + branch-exists detection; extend `test-workflow-references.mjs` to assert duplicate check removed and onboard script step present
- **Reason:** Spec scenarios must map to automated tests per project conventions

## Architecture

```
workflow_dispatch (onboarding.yml)
        │
        ▼
  Validate credentials (/oauth/token)
        │
        ▼
  onboard-workflow entry (Node)
   ├─ detect branch / registry existence
   ├─ setupGithubTenant() — branch, env, secrets, metadata
   └─ updateTenantRegistry() — merge tenants.yaml
        │
        ▼
  git push (tenant branch + main if registry changed)
        │
        ▼
  Summary (created | updated)
```

## Risks / Trade-offs

- **[Risk] Secret overwrite on accidental re-run** → Mitigation: workflow is manual; summary shows "updated"; document in README
- **[Risk] Concurrent onboarding on same tenant** → Mitigation: pull/rebase main before registry push (retain existing pattern)
- **[Trade-off] Requires ADMIN_TOKEN with secrets scope** → Accepted; unchanged from today
- **[Trade-off] onboard.mjs currently uses local PAT file for API** → Workflow must pass `GH_TOKEN` env; extend script to prefer `GH_TOKEN`/`ADMIN_TOKEN` when present

## Migration Plan

1. Extend `onboard.mjs` (or extract shared module) for CI/workflow token auth
2. Refactor `onboarding.yml` to call shared logic; remove duplicate check
3. Update spec delta; add tests
4. Document re-onboard path in README (replace "duplicate fails" note)
5. **Rollback:** Restore duplicate check step and bash-only workflow from git history

No data migration. Next onboarding run upserts target tenant.

## Open Questions

_(none — scope validated in brainstorm)_
