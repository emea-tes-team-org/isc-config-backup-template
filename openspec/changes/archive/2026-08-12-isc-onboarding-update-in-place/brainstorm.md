# Brainstorm: ISC Onboarding Update In Place

## Problem

The **ISC Onboarding** GitHub Actions workflow (`onboarding.yml`) rejects existing tenants before any work runs:

- Fails if tenant name already appears in `tenants.yaml`
- Fails if tenant branch already exists on `origin`

The local CLI (`scripts/onboard.mjs`) is already **idempotent**: it reuses branch/environment, overwrites secrets, updates `.tenant.yaml` / `.gitignore`, and merges `tenants.yaml` while preserving `schedule` and `environment` overrides.

This mismatch blocks common operator flows:

1. **Re-onboard after offboard** — offboard removes registry entry but preserves branch + environment; workflow fails on existing branch
2. **Secret refresh** — environment secrets lost or rotated; operators want one-click re-provision from GitHub UI
3. **Registry / metadata sync** — update `active`, `description`, or URL without CLI access

Recent incident: `mediolanum` offboarded then manual backup attempted; secrets empty across fleet since environments were recreated without secrets. CLI re-onboard works; Actions onboarding does not.

## Clarifications

### Q1: One workflow or separate "update" workflow?

**Decision:** **Single idempotent onboarding workflow.** Operators should not choose create vs update mode. Same inputs, same workflow — behavior adapts based on what already exists (mirrors CLI).

**Rejected:** Separate `onboarding-update.yml` — duplicates validation, credential checks, and drift risk vs CLI.

### Q2: What happens to existing backup data on the tenant branch?

**Decision:** **Preserve branch history and `backups/` content.** When branch exists, checkout that branch and commit metadata updates only. Never recreate branch from `main` (would risk losing backup tree or creating divergent history).

### Q3: What happens to `tenants.yaml` when tenant already registered?

**Decision:** **Merge/update entry** using same rules as `onboard.mjs` `updateTenantRegistry()`:

- Update `active`, `hostname`, `description` from inputs
- Preserve existing `schedule` if present; assign default `0 0 * * *` when activating without schedule
- Preserve `environment` override if present
- Preserve `exportPollMinutes` / `jobTimeoutMinutes` if present

### Q4: What happens when tenant is in registry but branch missing (edge case)?

**Decision:** **Create branch from main** (current new-tenant behavior) and commit metadata. Rare but safe recovery path.

### Q5: What happens when branch exists but tenant not in registry (post-offboard)?

**Decision:** **Re-register in `tenants.yaml`** and update branch metadata + secrets. Primary re-onboard scenario.

### Q6: Credential validation failure on update?

**Decision:** **No mutations** if `/oauth/token` fails — same as today. Validation runs before branch/registry/secret changes.

### Q7: Implementation strategy — shell steps vs shared script?

**Decision:** **Route workflow through shared Node onboarding logic** (extend `onboard.mjs` or thin `onboard-from-env.mjs` wrapper) invoked after credential validation. Avoid maintaining parallel bash for branch/registry/secret steps.

**Reason:** CLI already implements idempotent semantics; workflow duplication caused the drift.

### Q8: Should duplicate rejection scenario remain in spec?

**Decision:** **Replace** "Duplicate tenant name is rejected" with scenarios for update-in-place and re-onboard-after-offboard. Idempotency is the new contract.

### Q9: Confirmation for overwrite?

**Decision:** **No extra confirmation in v1.** Inputs already include secrets; operator explicitly triggers workflow. Document in summary whether run was create vs update.

## Approaches considered

| Approach | Pros | Cons |
|----------|------|------|
| **A. Idempotent onboarding.yml + shared script (chosen)** | CLI/workflow parity; one operator surface | Requires refactor of workflow steps |
| B. Separate update workflow | Smaller initial diff | Two workflows to maintain; operator confusion |
| C. Mode input (`create` / `update`) | Explicit intent | Extra friction; easy to pick wrong mode |

## Risks accepted

| Risk | Mitigation |
|------|------------|
| Accidental overwrite of secrets | Operator-initiated workflow; summary logs "updated" vs "created" |
| Concurrent onboarding runs on same tenant | Pull/rebase before `tenants.yaml` push (existing pattern) |
| Branch checkout conflicts during metadata commit | Use same git user/bot; single commit for `.tenant.yaml` + `.gitignore` |
