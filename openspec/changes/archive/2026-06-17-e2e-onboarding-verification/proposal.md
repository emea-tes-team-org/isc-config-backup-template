# Proposal: E2E Onboarding Verification

## Why

The `isc-onboarding` change introduced a GitHub Actions workflow that onboards ISC tenants, but task 4.5 (end-to-end test) remains the only unverified step. Without automated verification, regressions in the onboarding workflow will only surface when a real tenant fails to onboard — too late. A verification script that inspects post-onboarding artifacts confirms the workflow produces correct outputs before it's used in production.

## What Changes

- **Verification script**: new `scripts/verify-onboarding.mjs` that, given a tenant name, validates all onboarding artifacts exist and match expected formats
- **Branch artifact checks**: confirms the tenant branch exists, `.tenant.yaml` has correct fields, `.gitignore` ignores all `backups/*` except the tenant's directory
- **Environment and secrets checks**: confirms the GitHub Environment exists and has `TENANT_URL`, `CLIENT_ID`, `CLIENT_SECRET` secrets (names only — values are encrypted)
- **Registry check**: confirms the tenant is listed in `tenants.yaml` on `main` with expected name and active status
- **Backup readiness check**: triggers `scheduled-backup.yml` for the single tenant or instructs how, then verifies backup artifacts were committed to the tenant branch
- **Documentation**: updates README.md with verification run instructions

## Capabilities

### New Capabilities

- `onboarding-verification`: automated script that inspects post-onboarding Git and GitHub artifacts (branch, environment, secrets, registry entry, backup output) to confirm the onboarding workflow produced correct results

### Modified Capabilities

None. This is an additive verification-only capability. No existing specs change behaviour.

## Impact

- Affects: `scripts/verify-onboarding.mjs` (new), `README.md` (verification section)
- Dependencies: requires `gh` CLI authenticated with a token that can read environments and secrets (`repo` scope minimum), and a local git clone of the repository
- No breaking changes to `onboarding.yml`, `scheduled-backup.yml`, `tenants.yaml`, or any existing workflows
