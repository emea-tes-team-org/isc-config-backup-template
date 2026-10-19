## Why

The `tenants.yaml` index currently only tracks `name` and `active` for each tenant, while the human-readable `description` lives only in `.tenant.yaml` on each tenant branch. This makes it impossible to see what each tenant represents without checking out every branch, and prevents the dashboard and other registry consumers from surfacing meaningful tenant labels.

## What Changes

- Add an optional `description` field to each entry in `tenants.yaml`
- Update `scripts/parse-tenants.mjs` to preserve the `description` field when parsing
- Update the onboarding workflow (`onboarding.yml`) to write `description` into `tenants.yaml` when registering a new tenant
- Update the dashboard workflow (`dashboard.yml`) to display tenant descriptions alongside names
- **Backward compatible**: existing entries without `description` continue to work; field is optional

## Capabilities

### New Capabilities
- `tenant-description-in-index`: Optional human-readable description stored in the central `tenants.yaml` registry.

### Modified Capabilities
- `tenant-registry`: The central manifest format now supports an optional `description` field per tenant. Existing entries without the field remain valid.
- `isc-tenant-onboarding`: The onboarding workflow now appends `description` (when provided) to `tenants.yaml` alongside `name` and `active`.

## Impact

- `tenants.yaml` — new optional `description` field per tenant entry
- `scripts/parse-tenants.mjs` — preserves `description` in parsed output
- `.github/workflows/onboarding.yml` — writes `description` into `tenants.yaml` during registration
- `.github/workflows/dashboard.yml` — displays descriptions in generated dashboard
- `.github/workflows/sync-workflows.yml`, `scheduled-backup.yml`, `restore.yml` — no functional changes, but tenants.yaml format awareness
