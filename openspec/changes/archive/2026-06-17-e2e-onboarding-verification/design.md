# Design: E2E Onboarding Verification

## Context

The `isc-onboarding` workflow (`.github/workflows/onboarding.yml`) performs multiple side-effectful operations: branch creation, environment provisioning, secret encryption, file commits, and registry updates. Each step can fail independently, and partial failures may leave the repository in an inconsistent state (e.g., branch exists but environment doesn't).

Currently, verification of onboarding correctness is manual: a developer must inspect branch, environment, secrets, `.tenant.yaml`, `.gitignore`, and `tenants.yaml` individually. This is error-prone and unscalable as more tenants are onboarded.

The verification script provides a single command that inspects all artifacts and reports pass/fail per check. It does not modify anything — it is read-only.

For an architectural overview of the verification flow, see `c4_onboarding_verification.drawio`.

## Goals / Non-Goals

**Goals:**
- Single CLI command (`node scripts/verify-onboarding.mjs <tenant-name>`) that validates all onboarding artifacts
- Checks: branch exists, environment exists, secrets present (by name), `.tenant.yaml` fields correct, `.gitignore` pattern correct, tenant listed in `tenants.yaml`
- Human-readable output with pass/fail per check
- Runable locally with no dependencies beyond Node.js, `gh` CLI, and git
- Optional backup-trigger check: if `--backup` flag is provided, trigger `scheduled-backup.yml` for the tenant and wait for backup artifacts

**Non-Goals:**
- Running inside a GitHub Actions workflow (the script is designed for local verification by a developer)
- Modifying any repository state (read-only verification)
- Replacing manual code review of the onboarding workflow
- Testing credential validity (requires live ISC tenant credentials, which is the onboarding workflow's responsibility)

## Decisions

### 1. Single Node.js script with shell-outs

**Decision:** `verify-onboarding.mjs` is a single-file Node.js script that shells out to `gh` CLI and `git` for GitHub API and repository access.

**Rationale:** The existing codebase already uses `gh` CLI in `onboarding.yml` for environment/secret operations. Using the same tool from a verification script ensures consistent behavior and avoids duplicating auth logic. Node.js is already a project dependency (package.json).

**Alternative considered:** Pure Node.js script with `@octokit/rest` library. Rejected because it would introduce a new dependency and require its own auth token management, while `gh` CLI's `GH_TOKEN` env var pattern is already well-understood in this repo.

### 2. Read-only verification

**Decision:** The script performs no writes. It reports mismatches and missing artifacts but never creates, modifies, or deletes anything.

**Rationale:** Verification should be safe to run at any time, even against a partially-onboarded tenant. A read-only script can be used for debugging failed onboardings without risk of compounding the issue.

### 3. Check ordering matches creation order

**Decision:** Checks run in the same order as the onboarding workflow creates resources: branch → environment → secrets → `.tenant.yaml` → `.gitignore` → `tenants.yaml` → backup (optional).

**Rationale:** If the onboarding workflow failed mid-way, running checks in creation order helps surface the exact failure point. For example, if the branch exists but the environment doesn't, the onboarding workflow likely failed at the environment creation step.

### 4. Backup verification is opt-in

**Decision:** The `--backup` flag triggers a `scheduled-backup.yml` dispatch for the single tenant and polls for completion. Without the flag, backup checks are skipped.

**Rationale:** Running a backup requires the tenant to have valid credentials and the ISC API to be reachable — conditions that may not hold during initial development or for deactivated tenants. Making it opt-in keeps the base verification fast and non-disruptive.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| `gh` CLI not authenticated → all checks fail | Script exits early with a clear message: "Run `gh auth login` with a token that has `repo` scope" |
| Tenant branch was deleted manually after onboarding → false negative | Script reports branch missing and suggests re-running onboarding or manual cleanup |
| Race condition: onboarding running concurrently with verification | Document that verification should run against completed onboardings. The `--backup` check naturally serializes via GitHub Actions queue |
| `tenants.yaml` was reformatted → line-oriented check fails | Use structured YAML parsing (js-yaml) rather than line matching to be format-agnostic |

## Migration Plan

1. Add `scripts/verify-onboarding.mjs` to the repository
2. Update `README.md` with a "Verifying Onboarding" section
3. No deployment needed — the script is run locally
4. No rollback needed — the script is read-only and additive
5. Existing onboarded tenants can be verified immediately by running the script against their tenant names

## Open Questions

- Should the script also verify that `.tenant.yaml` values match the environment secrets? This would require decrypting secrets, which `gh` CLI does not support. Currently out of scope.
- Should verification be integrated into a GitHub Actions workflow that runs on each push to the tenant branch? This would catch drift automatically but adds complexity.
