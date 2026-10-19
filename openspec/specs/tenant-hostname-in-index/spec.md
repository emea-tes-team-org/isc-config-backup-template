# tenant-hostname-in-index Specification

## Purpose
TBD - created by archiving change add-hostname-and-next-backup. Update Purpose after archive.
## Requirements
### Requirement: Optional hostname reference in central registry

The system SHALL support an optional `hostname` field on each tenant entry in `tenants.yaml`, providing a human-readable reference to the tenant's SailPoint API hostname (for example `company12926-poc.identitynow-demo.com`). The hostname field is informational only — the authoritative URL continues to live in `.tenant.yaml` on the tenant's branch — and is used by the dashboard and report scripts for display purposes.

Feature: Tenant hostname reference

#### Scenario: Hostname is parsed alongside name and active
- **GIVEN** `tenants.yaml` contains:
  ```yaml
  - name: company21280-poc
    active: true
    hostname: company21280-poc.identitynow-demo.com
  ```
- **WHEN** the registry is parsed
- **THEN** the tenant object includes `hostname: "company21280-poc.identitynow-demo.com"`
- **AND** no error or warning is emitted

#### Scenario: Missing hostname is backward compatible
- **GIVEN** `tenants.yaml` contains a tenant without a `hostname` field:
  ```yaml
  - name: company12926-poc
    active: true
  ```
- **WHEN** the registry is parsed
- **THEN** the tenant is included in the matrix and dashboard data
- **AND** no error or warning is emitted
- **AND** consumers of the registry treat `hostname` as `undefined`

#### Scenario: Hostname appears verbatim in the CI matrix output
- **GIVEN** `tenants.yaml` contains a tenant with `hostname: axa.identitynow-demo.com`
- **WHEN** `node scripts/parse-tenants.mjs --active-only` is run
- **THEN** the matrix output includes a `hostname` field on every entry whose value matches the YAML

#### Scenario: Hostname is informational and not authoritative
- **GIVEN** `tenants.yaml` contains `hostname: foo.example.com` for a tenant
- **AND** the same tenant's branch has `.tenant.yaml` with `url: https://bar.api.example.com`
- **WHEN** the backup workflow runs for that tenant
- **THEN** the backup targets `bar.api.example.com` (the URL from `.tenant.yaml`)
- **AND** the dashboard and report display `foo.example.com` (the hostname from `tenants.yaml`)

