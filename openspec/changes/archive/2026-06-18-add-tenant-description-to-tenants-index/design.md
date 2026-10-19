## Context

The `tenants.yaml` file is the central registry of all onboarded tenants. It currently stores only `name` and `active` per tenant, with a comment noting that "Full metadata (description, active, url) lives in .tenant.yaml on each branch." This split makes the registry less useful for operators who want a quick overview without checking out individual branches.

The onboarding workflow (`onboarding.yml`) already accepts an optional `description` input, but only writes it to the branch-level `.tenant.yaml`. The dashboard workflow reads `tenants.yaml` but cannot display tenant descriptions because they are absent from the index.

`scripts/parse-tenants.mjs` parses `tenants.yaml` into a GitHub Actions matrix. It already has a generic key-value parser that will automatically pick up new fields, but the `description` field is not currently tested or guaranteed.

## Goals / Non-Goals

**Goals:**
- Allow each tenant entry in `tenants.yaml` to carry an optional `description` field
- Preserve backward compatibility: entries without `description` continue to work unchanged
- Update the onboarding workflow to propagate `description` into the index when provided
- Update the dashboard workflow to display descriptions when present

**Non-Goals:**
- Requiring `description` for all tenants (remains optional)
- Changing the branch-level `.tenant.yaml` format
- Modifying the parser's matrix output shape (tenant, branch, environment remain the core fields)
- Storing URL or credentials in `tenants.yaml` (those stay in branch-level files and GitHub Environments)

## Decisions

**1. Optional field with no default value**
- *Decision*: `description` is optional. When absent, the entry is exactly as before.
- *Rationale*: Forces zero migration for existing tenants. The onboarding workflow already writes `description: ""` when empty, so we will simply omit the field when empty.
- *Alternative considered*: Default to empty string `description: ""`. Rejected because it adds noise to the YAML.

**2. Append order in onboarding workflow**
- *Decision*: Write `description` immediately after `active` in the onboarding append step.
- *Rationale*: Matches the natural top-to-bottom order of tenant metadata. Keeps the parser's line-based logic working without changes.
- *Example output*:
  ```yaml
  - name: company21280-poc
    active: true
    description: "Fernando's tenant"
  ```

**3. No parser schema change**
- *Decision*: Rely on the existing generic key-value parser in `parse-tenants.mjs` to capture `description`.
- *Rationale*: The parser already splits on `:` and stores arbitrary keys. We only need to verify it handles quoted strings correctly.
- *Alternative considered*: Hard-coding `description` in the parser. Rejected because it adds maintenance burden without benefit.

**4. Dashboard displays description inline**
- *Decision*: Add a Description column (or inline label) in the generated `DASHBOARD.md`.
- *Rationale*: Low-friction visibility. If description is absent, the column shows "—" or is omitted per row.

## Risks / Trade-offs

- **[Risk] Workflows that grep `tenants.yaml` with strict line matching may break** -> Mitigation: Audit all grep patterns. `restore.yml` uses `grep -A5 "name: $tenant$"` which already scans a few lines after the name and will continue to work. `onboarding.yml` duplicate check uses `grep -E "^\s*-\s*name:\s*${TENANT_NAME}\s*$"` which is unchanged.
- **[Risk] Parser output silently grows** -> Mitigation: The matrix output JSON only includes `tenant`, `branch`, and `environment`. Extra parsed fields do not pollute the GitHub Actions matrix. A test should verify this.
- **[Trade-off] Index bloat** -> Adding descriptions to `tenants.yaml` makes the file larger, but descriptions are typically short (human-readable labels). The benefit of a self-describing registry outweighs the cost.

## Migration Plan

No migration required. Existing `tenants.yaml` entries without `description` remain valid.

For existing tenants that already have `.tenant.yaml` with a description, operators may optionally update `tenants.yaml` manually or re-run onboarding if desired, but this is not required.

## Open Questions

None.
