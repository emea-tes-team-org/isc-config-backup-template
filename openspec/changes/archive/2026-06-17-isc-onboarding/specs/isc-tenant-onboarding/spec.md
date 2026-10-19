# ISC Tenant Onboarding

## ADDED Requirements

### Requirement: One-click onboarding via workflow dispatch

The system SHALL provide a GitHub Actions workflow that accepts `api_url`, `client_id`, `client_secret`, and optional `tenant_name`, `active`, and `description` inputs and performs a fully automated tenant setup including credential validation, branch creation, environment configuration, secret provisioning, branch metadata, and registry registration.

#### Scenario: Successful onboarding with valid credentials

GIVEN the `ADMIN_TOKEN` repository secret is configured
AND the onboarding workflow is triggered with valid inputs:
  `api_url` = "https://company12926-poc.api.identitynow-demo.com",
  `client_id` = <valid client id>,
  `client_secret` = <valid client secret>,
  `active` = true
WHEN the workflow executes
THEN the ISC tenant name is extracted from `api_url` as "company12926-poc"
AND the credentials are validated against `https://company12926-poc.api.identitynow-demo.com/oauth/token`
AND a branch named "company12926-poc" is created from `main`
AND a GitHub Environment named "company12926-poc" is created
AND the environment contains secrets `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET`
AND `.tenant.yaml` is committed to the "company12926-poc" branch with name, url, active, and description
AND a branch-specific `.gitignore` is committed to the "company12926-poc" branch
AND the tenant is appended to `tenants.yaml` on `main` with `active: true`
AND the workflow reports success

#### Scenario: Failed credential validation blocks setup

GIVEN the onboarding workflow is triggered with invalid `client_id` or `client_secret`
WHEN the credential validation step attempts `/oauth/token`
AND the ISC API returns `401 Unauthorized`
THEN the workflow fails with a clear error message indicating invalid credentials
AND no branch is created
AND no GitHub Environment is created
AND no entry is written to `tenants.yaml`

#### Scenario: Duplicate tenant name is rejected

GIVEN a tenant named "company12926-poc" already exists in `tenants.yaml`
WHEN the onboarding workflow is triggered with an `api_url` that resolves to the same tenant name
THEN the workflow fails with a message indicating the tenant is already onboarded
AND no duplicate branch or environment is created

### Requirement: Tenant name is derived from the API URL

The system SHALL extract the tenant name from the `api_url` input by parsing the hostname and taking the first subdomain component, matching the convention used by `common.mjs` and `scripts/onboard.mjs`.

#### Scenario: Tenant name extraction from standard ISC URL

GIVEN `api_url` = "https://company12926-poc.api.identitynow-demo.com"
WHEN the tenant name is extracted
THEN the result is "company12926-poc"

#### Scenario: Tenant name extraction from custom domain URL

GIVEN `api_url` = "https://acme.identitynow.com"
WHEN the tenant name is extracted
THEN the result is "acme"

### Requirement: Branch metadata matches the local onboarding CLI

The system SHALL commit the same `.tenant.yaml` and `.gitignore` files to the new tenant branch that `scripts/onboard.mjs` produces, so existing workflows (backup, sync, drift-detection, dashboard) continue to work without modification.

#### Scenario: Branch descriptor is created

GIVEN a new tenant "company12926-poc" is onboarded
WHEN the workflow completes
THEN the tenant branch contains `.tenant.yaml` with:
  `name: company12926-poc`
  `url: "https://company12926-poc.api.identitynow-demo.com"`
  `active: true`
  `description: "..."`
AND the tenant branch contains a `.gitignore` that ignores all `backups/*` except `backups/company12926-poc/`

### Requirement: Onboarding workflow runs on main only

The onboarding workflow SHALL only execute when triggered against the `main` branch, since main holds the authoritative tenant registry and is the branch from which tenant branches are created.

#### Scenario: Onboarding rejects non-main triggers

GIVEN the onboarding workflow is triggered on a branch that is not `main`
WHEN the workflow starts
THEN it fails immediately with a message indicating it must be run from `main`
