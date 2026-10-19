## MODIFIED Requirements

### Requirement: CLI routes schedule-toggle and offboard commands

The unified CLI SHALL route `schedule-toggle` and `offboard` commands to dedicated scripts in `scripts/`.

#### Scenario: CLI routes schedule-toggle command

- **GIVEN** `scripts/schedule-toggle.mjs` exists
- **WHEN** the developer runs `node scripts/cli.mjs schedule-toggle acme-prod`
- **THEN** the CLI delegates to `scripts/schedule-toggle.mjs` with argument `acme-prod`

#### Scenario: CLI routes offboard command

- **GIVEN** `scripts/offboard.mjs` exists
- **WHEN** the developer runs `node scripts/cli.mjs offboard acme-prod`
- **THEN** the CLI delegates to `scripts/offboard.mjs` with argument `acme-prod`
- **AND** offboard retains the latest backup tag and deletes older tenant tags via the delegated script

#### Scenario: CLI help lists new commands

- **GIVEN** the developer runs `node scripts/cli.mjs --help`
- **WHEN** the help text is displayed
- **THEN** it includes `schedule-toggle` and `offboard` in the command list
