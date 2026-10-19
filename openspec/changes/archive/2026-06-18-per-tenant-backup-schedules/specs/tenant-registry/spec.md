## ADDED Requirements

### Requirement: Optional schedule field in tenant registry

The `tenants.yaml` registry SHALL support an optional `schedule` field on each tenant entry. The field contains a standard 5-field cron expression (minute hour day-of-month month day-of-week).

#### Scenario: Registry with schedule fields is valid
- **GIVEN** `tenants.yaml` contains a tenant with `schedule: "0 6 * * 1"`
- **WHEN** `scripts/parse-tenants.mjs` reads the file
- **THEN** the tenant object includes `schedule: "0 6 * * 1"`
- **AND** parsing succeeds without errors

#### Scenario: Registry without schedule fields remains valid
- **GIVEN** `tenants.yaml` contains tenants with no `schedule` field
- **WHEN** `scripts/parse-tenants.mjs` reads the file
- **THEN** the tenant object has `schedule` as `undefined` or omitted
- **AND** the parser treats missing schedule as always-matching (daily default)
