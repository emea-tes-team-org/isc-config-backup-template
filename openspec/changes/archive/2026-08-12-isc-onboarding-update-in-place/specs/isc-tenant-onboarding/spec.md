## MODIFIED Requirements

### Requirement: One-click onboarding via workflow dispatch

The system SHALL provide a GitHub Actions workflow that accepts `api_url`, `client_id`, `client_secret`, and optional `tenant_name`, `active`, and `description` inputs and performs a fully automated tenant setup including credential validation, branch creation or update, environment configuration, secret provisioning, branch metadata, and registry registration or update. When the tenant branch or registry entry already exists, the workflow SHALL update resources in place rather than failing.

#### Scenario: Successful onboarding with valid credentials

GIVEN the `ADMIN_TOKEN` repository secret is configured
AND the onboarding workflow is triggered with valid inputs:
  `api_url` = "https://company12926-poc.api.identitynow-demo.com",
  `client_id` = <valid client id>,
  `client_secret` = <valid client secret>,
  `active` = true
WHEN the workflow executes
AND neither the tenant branch nor registry entry exists yet
THEN the ISC tenant name is extracted from `api_url` as "company12926-poc"
AND the credentials are validated against `https://company12926-poc.api.identitynow-demo.com/oauth/token`
AND a branch named "company12926-poc" is created from `main`
AND a GitHub Environment named "company12926-poc" is created
AND the environment contains secrets `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET`
AND `.tenant.yaml` is committed to the "company12926-poc" branch with name, url, active, and description
AND a branch-specific `.gitignore` is committed to the "company12926-poc" branch
AND the tenant is appended to `tenants.yaml` on `main` with `active: true`
AND the workflow reports success with a summary indicating the tenant was created

#### Scenario: Failed credential validation blocks setup

GIVEN the onboarding workflow is triggered with invalid `client_id` or `client_secret`
WHEN the credential validation step attempts `/oauth/token`
AND the ISC API returns `401 Unauthorized`
THEN the workflow fails with a clear error message indicating invalid credentials
AND no branch is created or modified
AND no GitHub Environment secrets are written
AND no entry is written or updated in `tenants.yaml`

#### Scenario: Existing registered tenant is updated in place

GIVEN a tenant named "acme-prod" already exists in `tenants.yaml` with `schedule: "0 0 * * *"` and `environment: acme-prod`
AND branch "acme-prod" exists on `origin` with backup history under `backups/acme-prod/`
WHEN the onboarding workflow is triggered with valid credentials and updated `description` for "acme-prod"
THEN the workflow validates credentials successfully
AND the existing branch is not recreated from `main`
AND `.tenant.yaml` and branch `.gitignore` are updated on branch "acme-prod"
AND GitHub Environment "acme-prod" secrets `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET` are overwritten
AND `tenants.yaml` entry for "acme-prod" is merged in place
AND existing `schedule` and `environment` fields are preserved
AND the workflow reports success with a summary indicating the tenant was updated

#### Scenario: Duplicate tenant name is rejected

GIVEN a tenant named "company12926-poc" already exists in `tenants.yaml`
WHEN the onboarding workflow is triggered with an `api_url` that resolves to the same tenant name and valid credentials
THEN the workflow does not fail with a duplicate-tenant error
AND the tenant is updated in place (secrets refreshed, metadata and registry merged)
AND no duplicate branch is created from `main`

#### Scenario: Re-onboard after offboard restores registry without losing branch

GIVEN tenant "mediolanum" was offboarded: removed from `tenants.yaml` but branch "mediolanum" and environment "mediolanum" still exist
AND branch "mediolanum" contains squashed backup snapshot under `backups/mediolanum/`
WHEN the onboarding workflow is triggered with valid credentials for "mediolanum"
THEN credentials are validated
AND branch "mediolanum" is not recreated from `main`
AND environment secrets are set on "mediolanum"
AND "mediolanum" is added back to `tenants.yaml` with fields from workflow inputs
AND backup files on the branch remain present
AND the workflow reports success indicating the tenant was updated or re-registered
