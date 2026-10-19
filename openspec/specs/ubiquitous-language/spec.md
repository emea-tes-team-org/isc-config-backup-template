# Ubiquitous Language

## Purpose

Shared vocabulary for the ISC Config Hub CI/CD bounded context. All specs, ADRs, workflows, and operator documentation SHALL use these terms consistently.
## Requirements
### Requirement: Term — ISC Tenant

An **ISC Tenant** SHALL mean a SailPoint Identity Security Cloud organization instance identified by a unique API hostname (e.g., `https://acme.api.identitynow.com`). Each ISC Tenant backed up by this repository corresponds to exactly one registered entry in the system.

#### Scenario: One registered entry per ISC tenant

- **GIVEN** ISC tenant at `https://acme.api.identitynow.com` is onboarded as "acme-prod"
- **WHEN** an operator refers to "the acme-prod tenant"
- **THEN** they mean the single registered instance with that tenant name, branch, environment, and backup folder

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

### Requirement: Term — GitHub Environment

A **GitHub Environment** SHALL mean a repository Environment named after the tenant (or an explicit `environment` override in `tenants.yaml`) that stores Environment-scoped secrets: `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET`. Environments are persistent. Deployment records created when jobs reference an environment are ephemeral and are removed by backup workflows.

#### Scenario: Environment scopes backup credentials

- **GIVEN** backup runs for tenant "acme-prod"
- **WHEN** the workflow job sets `environment: acme-prod`
- **THEN** secrets from the "acme-prod" Environment are injected

#### Scenario: Environment survives deployment cleanup

- **GIVEN** backup cleanup deleted the Deployment trace for "acme-prod"
- **WHEN** the next backup job runs for "acme-prod"
- **THEN** environment "acme-prod" still exists
- **AND** secrets are still injected

### Requirement: Term — Ephemeral Deployment Trace

An **Ephemeral Deployment Trace** SHALL mean the GitHub Deployment API record automatically created when a workflow job references `environment:`. Its status mirrors the job outcome (`success`, `failure`, etc.). Backup workflows SHALL delete this record after each job; it is not the backup audit trail.

#### Scenario: Deployment trace is not backup audit

- **GIVEN** a scheduled backup job for tenant "acme-prod" completes
- **WHEN** an operator needs the backup outcome
- **THEN** they consult Actions run history, git tags, branch commits, or `reports/backup-summary-*.md`
- **AND** not the Environments deployment history page

#### Scenario: Deployment trace distinct from GitHub Environment

- **GIVEN** tenant "acme-prod" has GitHub Environment "acme-prod"
- **WHEN** a backup job sets `environment: acme-prod`
- **THEN** GitHub injects secrets from the Environment
- **AND** GitHub also creates a Deployment record
- **AND** backup cleanup deletes the Deployment record but preserves the Environment

### Requirement: Term — Tenant Registry

The **Tenant Registry** SHALL mean the `tenants.yaml` file on `main` that indexes all onboarded tenants with at minimum `name` and `active` fields, plus optional `schedule`, `description`, and `hostname`.

#### Scenario: Registry is authoritative index

- **GIVEN** a tenant is listed in `tenants.yaml` with `active: true`
- **WHEN** the scheduled backup matrix runs
- **THEN** the registry is the source used to determine inclusion

### Requirement: Term — Tenant Descriptor

A **Tenant Descriptor** SHALL mean the `.tenant.yaml` file on each tenant branch containing full metadata: `name`, `url`, `active`, and optional `description`. Secrets are NOT stored in the descriptor.

#### Scenario: Descriptor holds reference URL only

- **GIVEN** tenant branch "acme-prod" has `.tenant.yaml`
- **WHEN** the file is read
- **THEN** it contains `url` as a reference
- **AND** live credentials remain in the GitHub Environment only

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

### Requirement: Term — Backup Tag

A **Backup Tag** SHALL mean a git tag named `<tenant>/<YYYY-MM-DD_HH-MM-SS>` (UTC) pointing at the commit HEAD after a backup run, usable as a restore source ref.

#### Scenario: Tag selects point-in-time backup

- **GIVEN** tag "acme-prod/2026-01-15_06-00-00" exists
- **WHEN** an operator selects that tag as the restore workflow source
- **THEN** backup data from that tag's commit is used

### Requirement: Term — Scheduled Backup Matrix

The **Scheduled Backup Matrix** SHALL mean the centralized workflow on `main` that parses the tenant registry, determines pending tenants for the current schedule window, and dispatches parallel backup jobs.

#### Scenario: Matrix coordinates all active tenants

- **GIVEN** three active tenants are pending backup
- **WHEN** the Scheduled Backup Matrix runs
- **THEN** three parallel backup jobs are dispatched

### Requirement: Term — Active Tenant

An **Active Tenant** SHALL mean a tenant registry entry with `active: true`, eligible for inclusion in the scheduled backup matrix.

#### Scenario: Deactivated tenant excluded

- **GIVEN** tenant "acme-dev" has `active: false` in `tenants.yaml`
- **WHEN** the scheduled backup matrix runs
- **THEN** "acme-dev" is not included regardless of schedule

### Requirement: Term — Cross-Tenant Restore

**Cross-Tenant Restore** SHALL mean uploading configuration from one tenant's backup (source) to a different ISC tenant (target), using the target tenant's credentials.

#### Scenario: Dev to prod promotion

- **GIVEN** backup on branch "acme-dev"
- **WHEN** restore targets tenant "acme-prod"
- **THEN** acme-dev backup data is uploaded to the acme-prod ISC instance

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

### Requirement: Term — Semantic Diff Restore

**Semantic Diff Restore** SHALL mean a restore mode that uploads only configuration objects that differ between the source backup and the target tenant's current ISC state.

#### Scenario: Only changed objects uploaded

- **GIVEN** source and target differ on 3 objects
- **WHEN** restore mode is "semantic-diff"
- **THEN** exactly 3 objects are uploaded

### Requirement: Term — Full Restore

**Full Restore** SHALL mean a restore mode that uploads all objects from the source backup regardless of current target state.

#### Scenario: All source objects uploaded

- **GIVEN** source backup contains 150 objects
- **WHEN** restore mode is "full"
- **THEN** all 150 objects are uploaded

### Requirement: Term — Token

A **Token** SHALL mean a placeholder in the format `{{UPPER_SNAKE_CASE}}` representing an environment-specific value in a tokenized template file, resolved at restore time from a vars file.

#### Scenario: Token resolved at restore

- **GIVEN** template contains `"url": "{{SERVICENOW_URL}}"`
- **AND** `vars/production.vars.yaml` has `SERVICENOW_URL: "https://prod.example.com"`
- **WHEN** restore runs with `--vars production`
- **THEN** the URL is substituted before upload

### Requirement: Term — Template

A **Template** SHALL mean a tokenized configuration file under `templates/<name>/` mirroring backup JSON structure but with tokens replacing environment-specific fields.

#### Scenario: Template mirrors backup structure

- **GIVEN** template set "default" was created from tenant "beta-15156"
- **WHEN** templates are inspected
- **THEN** files exist at `templates/default/<TYPE>/<name>.json` with token placeholders

### Requirement: Term — Vars File

A **Vars File** SHALL mean a YAML file under `vars/<tenant>.vars.yaml` mapping token names to resolved environment-specific values for a target tenant.

#### Scenario: Vars file maps tokens to values

- **GIVEN** `vars/production.vars.yaml` exists
- **WHEN** restore uses `--vars production`
- **THEN** each `{{TOKEN}}` in templates is replaced with the corresponding vars entry

### Requirement: Term — Drift

**Drift** SHALL mean a configuration object whose live ISC state differs from the latest git backup for that tenant.

#### Scenario: Drift detected

- **GIVEN** a WORKFLOW was modified in ISC after the last backup
- **WHEN** drift detection runs
- **THEN** that WORKFLOW is reported as drifted

### Requirement: Term — ADMIN_TOKEN

**ADMIN_TOKEN** SHALL mean a repository secret holding a fine-grained GitHub PAT for this repository, with Administration, Environments, Contents, and Workflows set to read and write, and Actions set to read-only. The onboarding workflow requires it to create GitHub Environments and environment-scoped secrets, and to push commits that include workflow files.

#### Scenario: ADMIN_TOKEN required for onboarding

- **GIVEN** onboarding needs to create Environment "new-tenant"
- **WHEN** `ADMIN_TOKEN` is not configured
- **THEN** onboarding cannot create the Environment

### Requirement: Term — Configuration Hub

**Configuration Hub** SHALL mean the SailPoint UI Development Kit component that provides a visual interface for browsing git backups and restoring objects to ISC, consuming this repository as its data source.

#### Scenario: Config Hub reads repository backups

- **GIVEN** Config Hub is configured with this repository URL and backups path
- **WHEN** an operator browses configuration history
- **THEN** objects are read from `backups/<tenant>/` via the GitHub API

### Requirement: Term — Branch-Per-Tenant Model

The **Branch-Per-Tenant Model** SHALL mean the architectural pattern where each ISC tenant gets an isolated git branch, GitHub Environment, and backup folder, coordinated by a central registry and scheduler on `main`.

#### Scenario: Model isolates tenants

- **GIVEN** the branch-per-tenant model is in use
- **WHEN** two tenants are onboarded
- **THEN** each has separate branch, environment, secrets, and backup history
- **AND** scheduling is coordinated from `main` via `tenants.yaml`

