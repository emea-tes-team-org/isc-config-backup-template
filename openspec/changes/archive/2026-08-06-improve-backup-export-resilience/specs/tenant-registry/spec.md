## ADDED Requirements

### Requirement: Optional backup timeout fields in tenant registry

Each tenant entry in `tenants.yaml` MAY include optional `exportPollMinutes` and `jobTimeoutMinutes` integer fields. When omitted, defaults SHALL be 10 and 15 respectively.

#### Scenario: Parser includes timeout fields in matrix output

- **GIVEN** tenant "axa" has `exportPollMinutes: 20` and `jobTimeoutMinutes: 25`
- **WHEN** parse-tenants produces the matrix entry
- **THEN** the entry includes `jobTimeoutMinutes: 25`
- **AND** backup script receives `exportPollMinutes` via environment or CLI flag
