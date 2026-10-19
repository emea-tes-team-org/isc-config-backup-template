# Ubiquitous Language — Delta

## MODIFIED Requirements

### Requirement: Term — Tenant Name

**Tenant Name** SHALL mean the lowercase alphanumeric identifier (hyphens allowed) chosen at onboarding that is the single source of truth for branch name, registry key, and (by default) GitHub Environment name. It MAY differ from the ISC API URL subdomain. When the Environment name differs, `tenants.yaml` SHALL declare an explicit `environment` override.

#### Scenario: Human-chosen tenant name

- **GIVEN** ISC tenant at `https://company12926-poc.api.identitynow-demo.com` is onboarded as "fernando"
- **WHEN** an operator refers to "the fernando tenant"
- **THEN** they mean the registered entry with branch `fernando`, not the URL subdomain

#### Scenario: Tenant name derivation

- **GIVEN** API URL `https://company12926-poc.api.identitynow-demo.com`
- **WHEN** the tenant name is extracted during onboarding without an override
- **THEN** the default result is "company12926-poc"
- **AND** an operator MAY choose a different tenant name at onboarding time

#### Scenario: Hostname for display

- **GIVEN** tenant "fernando" has `hostname: company12926-poc.api.identitynow-demo.com` in `tenants.yaml`
- **WHEN** the operations dashboard displays fleet status
- **THEN** the hostname is shown as reference metadata
- **AND** the tenant name remains the operational identifier

### Requirement: Term — Configuration Backup

A **Configuration Backup** SHALL mean an SP-Config export stored as JSON files under `backups/` on the tenant branch, organized by object type (`backups/<TYPE>/<id>.json`). The tenant branch name scopes the backup; a nested `backups/<tenant-name>/` folder SHALL NOT be used.

#### Scenario: Flat backup layout on tenant branch

- **GIVEN** tenant branch "fernando" exists
- **WHEN** a backup completes
- **THEN** files exist at `backups/ROLE/<id>.json` on branch "fernando"
- **AND** no `backups/fernando/` subdirectory is created

#### Scenario: Backup is SP-Config export

- **GIVEN** a backup completes for tenant "fernando"
- **WHEN** the backup directory is inspected on branch "fernando"
- **THEN** files exist at `backups/<TYPE>/<id>.json`
- **AND** each file contains the SP-Config export envelope

### Requirement: Term — Tenant Branch

A **Tenant Branch** SHALL mean a dedicated git branch holding only data artifacts: flat `backups/`, `.tenant.yaml`, branch-specific `.gitignore`, and optional `templates/` and `vars/`. It SHALL NOT contain `.github/workflows/`, `scripts/`, or other application files from `main`.

#### Scenario: Branch is data-only

- **GIVEN** tenant branch "andre" exists
- **WHEN** the branch tree is inspected
- **THEN** `.github/workflows/` is absent
- **AND** `scripts/` is absent
- **AND** `backups/` contains backup JSON

#### Scenario: Branch isolates tenant backup history

- **GIVEN** tenants "acme-prod" and "acme-dev" exist
- **WHEN** backup commits are made
- **THEN** acme-prod commits land on branch "acme-prod" only
- **AND** acme-dev commits land on branch "acme-dev" only

### Requirement: Term — Source Ref

**Source Ref** SHALL mean an explicit git branch or tag name passed as workflow input when triggering restore from `main`, identifying which backup snapshot to restore from.

#### Scenario: Source ref from tag input

- **GIVEN** restore workflow runs from `main` with `source_ref: fernando/2026-08-12_00-00-00`
- **WHEN** restore executes
- **THEN** backup data is read from that tag's commit at flat `backups/` paths

#### Scenario: Source ref from tag

- **GIVEN** restore workflow runs from `main` with `source_ref: acme-prod/2026-01-15_06-00-00`
- **WHEN** restore executes
- **THEN** `source_ref` resolves to that tag's commit

## REMOVED Requirements

### Requirement: Term — workflow sync to tenant branches

_(Removed — workflow files exist only on `main`; see platform-integration delta.)_
