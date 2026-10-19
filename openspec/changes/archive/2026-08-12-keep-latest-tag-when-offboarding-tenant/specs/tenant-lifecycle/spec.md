## MODIFIED Requirements

### Requirement: Self-service onboarding from GitHub UI

The system SHALL allow operators to onboard a new ISC tenant entirely through **Actions > ISC Onboarding > Run workflow** without local tooling, and to pause or decommission tenants through **Actions > ISC Schedule Toggle** and **Actions > ISC Offboard** without local tooling.

#### Scenario: Onboarding via workflow dispatch

- **GIVEN** the `ADMIN_TOKEN` repository secret is configured
- **WHEN** an operator runs ISC Onboarding with valid `api_url`, `client_id`, and `client_secret`
- **THEN** credentials are validated against the ISC OAuth endpoint
- **AND** the tenant branch, environment, secrets, `.tenant.yaml`, `.gitignore`, and registry entry are created
- **AND** the tenant is eligible for the next scheduled backup matrix run

#### Scenario: Schedule toggle via workflow dispatch

- **GIVEN** tenant "acme-prod" is registered with `active: true`
- **WHEN** an operator runs ISC Schedule Toggle with `tenant_name` = "acme-prod"
- **THEN** `tenants.yaml` on `main` is updated with `active: false`
- **AND** no branch or tag data is modified

#### Scenario: Offboard via workflow dispatch

- **GIVEN** tenant "acme-prod" is registered and has backup history
- **WHEN** an operator runs ISC Offboard with matching confirmation
- **THEN** the tenant is removed from `tenants.yaml`
- **AND** all "acme-prod/*" backup tags except the latest by name-embedded UTC timestamp are deleted
- **AND** the latest "acme-prod/*" backup tag remains when at least one valid backup tag existed
- **AND** branch "acme-prod" is squashed to a single snapshot commit
