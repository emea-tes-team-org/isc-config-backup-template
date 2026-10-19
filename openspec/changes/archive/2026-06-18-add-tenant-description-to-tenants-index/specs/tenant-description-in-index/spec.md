## ADDED Requirements

### Requirement: Optional tenant description in central registry

The system SHALL support an optional `description` field on each tenant entry in `tenants.yaml`, providing a human-readable label that is visible without checking out the tenant branch.

#### Scenario: Description is stored alongside name and active

GIVEN `tenants.yaml` contains:
  ```yaml
  - name: company21280-poc
    active: true
    description: "Fernando's tenant"
  ```
WHEN `node scripts/parse-tenants.mjs --all --json` is run
THEN the parsed tenant object includes `description: "Fernando's tenant"`
AND the GitHub Actions matrix output still contains only `tenant`, `branch`, and `environment` fields

#### Scenario: Missing description is backward compatible

GIVEN `tenants.yaml` contains a tenant without a `description` field:
  ```yaml
  - name: company12926-poc
    active: true
  ```
WHEN the registry is parsed
THEN the tenant is included in the matrix
AND no error or warning is emitted

#### Scenario: Dashboard displays descriptions when present

GIVEN `tenants.yaml` contains tenants with and without descriptions
WHEN the dashboard workflow runs
THEN `DASHBOARD.md` lists each tenant with its description if present
AND omits or marks "—" for tenants lacking a description
