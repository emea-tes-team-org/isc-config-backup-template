## ADDED Requirements

### Requirement: Per-tenant wrapper workflows for lifecycle actions

The system SHALL generate per-tenant GitHub Actions wrapper workflows for verify and offboard that dispatch `isc-lifecycle.yml` with tenant and operation pre-set, alongside existing backup and toggle wrappers.

#### Scenario: Verify wrapper dispatches lifecycle verify

- **GIVEN** tenant "acme-prod" is registered in `tenants.yaml`
- **WHEN** shortcut generation runs
- **THEN** workflow file `isc-verify-acme-prod.yml` exists
- **AND** triggering it with no inputs dispatches `isc-lifecycle.yml` with `operation=verify` and `tenant=acme-prod`

#### Scenario: Offboard wrapper validates keyword confirm

- **GIVEN** workflow `isc-offboard-acme-prod.yml` exists
- **WHEN** an operator runs it with confirm input not equal to `offboard`
- **THEN** the workflow fails validation before dispatching lifecycle offboard

#### Scenario: Offboard wrapper dispatches lifecycle offboard

- **GIVEN** workflow `isc-offboard-acme-prod.yml` exists
- **WHEN** an operator runs it with confirm input equal to `offboard`
- **THEN** `isc-lifecycle.yml` is dispatched with `operation=offboard`, `tenant=acme-prod`, and `confirm_tenant=acme-prod`

---

## MODIFIED Requirements

### Requirement: Self-service onboarding from GitHub UI

The system SHALL allow operators to onboard a new ISC tenant through **Actions > ISC Lifecycle** (onboard operation) without local tooling, and to pause, verify, or decommission tenants through per-tenant wrapper workflows linked from the operations dashboard without local tooling.

#### Scenario: Onboarding via workflow dispatch

- **GIVEN** the `ADMIN_TOKEN` repository secret is configured
- **WHEN** an operator runs ISC Lifecycle with operation `onboard` and valid `api_url`, `client_id`, and `client_secret`
- **THEN** credentials are validated against the ISC OAuth endpoint
- **AND** the tenant branch, environment, secrets, `.tenant.yaml`, `.gitignore`, and registry entry are created
- **AND** the tenant is eligible for the next scheduled backup matrix run

#### Scenario: Schedule toggle via workflow dispatch

- **GIVEN** tenant "acme-prod" is registered with `active: true`
- **WHEN** an operator runs `isc-toggle-acme-prod.yml` with no inputs
- **THEN** `tenants.yaml` on `main` is updated with `active: false`
- **AND** no branch or tag data is modified

#### Scenario: Offboard via workflow dispatch

- **GIVEN** tenant "acme-prod" is registered and has backup history
- **WHEN** an operator runs `isc-offboard-acme-prod.yml` with confirm input `offboard`
- **THEN** the tenant is removed from `tenants.yaml`
- **AND** all "acme-prod/*" backup tags except the latest by name-embedded UTC timestamp are deleted
- **AND** the latest "acme-prod/*" backup tag remains when at least one valid backup tag existed
- **AND** branch "acme-prod" is squashed to a single snapshot commit

### Requirement: Post-onboarding verification

The system SHALL provide verification via `npm run cli -- verify <tenant>` and via per-tenant verify wrapper workflows that dispatch lifecycle verify without requiring a tenant input.

#### Scenario: Verification passes for fully onboarded tenant

- **GIVEN** tenant "acme-prod" was successfully onboarded
- **WHEN** `npm run cli -- verify acme-prod` is run with authenticated `gh` CLI
- **THEN** all artifact checks report PASSED
- **AND** the command exits with code 0

#### Scenario: Verification via per-tenant wrapper

- **GIVEN** tenant "acme-prod" was successfully onboarded
- **WHEN** an operator runs `isc-verify-acme-prod.yml` with no inputs
- **THEN** lifecycle verify runs for tenant "acme-prod"
- **AND** all artifact checks report PASSED
