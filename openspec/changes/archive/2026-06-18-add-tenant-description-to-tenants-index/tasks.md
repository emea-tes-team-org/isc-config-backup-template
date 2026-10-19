## 1. Update tenant parser to preserve description

- [x] 1.1 Add test cases in `scripts/parse-tenants.mjs` (or a test file) to verify `description` is parsed and preserved for active and inactive tenants
- [x] 1.2 Verify the GitHub Actions matrix output does NOT include `description` (only `tenant`, `branch`, `environment`)

## 2. Update onboarding workflow to write description into index

- [x] 2.1 Modify `.github/workflows/onboarding.yml`: append `description` to `tenants.yaml` when the input is non-empty
- [x] 2.2 Ensure backward compatibility: when `description` input is empty, omit the field entirely from `tenants.yaml`
- [x] 2.3 Verify the append format matches the expected YAML structure (name, active, description order)

## 3. Update dashboard workflow to display descriptions

- [x] 3.1 Modify `.github/workflows/dashboard.yml` to extract `description` from `tenants.yaml` for each tenant
- [x] 3.2 Update `DASHBOARD.md` generation to include a Description column or inline label
- [x] 3.3 Handle missing descriptions gracefully (show "—" or omit)

## 4. Documentation and registry update

- [x] 4.1 Update the header comment in `tenants.yaml` to mention the optional `description` field
- [x] 4.2 Update `tenant.example.yaml` if needed to reflect the new index field

## 5. Validation and archive

- [x] 5.1 Run `openspec validate add-tenant-description-to-tenants-index --type change --strict`
- [x] 5.2 Run the parser locally against a test `tenants.yaml` to confirm output shape
- [x] 5.3 Archive the change with `openspec archive add-tenant-description-to-tenants-index`
