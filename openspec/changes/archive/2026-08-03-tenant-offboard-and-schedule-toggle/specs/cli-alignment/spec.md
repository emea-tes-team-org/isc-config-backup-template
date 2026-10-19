## ADDED Requirements

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

#### Scenario: CLI help lists new commands

- **GIVEN** the developer runs `node scripts/cli.mjs --help`
- **WHEN** the help text is displayed
- **THEN** it includes `schedule-toggle` and `offboard` in the command list

## MODIFIED Requirements

### Requirement: Unified CLI entrypoint routes commands to scripts

The system SHALL expose a single CLI entrypoint that delegates to the underlying scripts in `scripts/` so local execution matches GitHub Actions execution.

#### Scenario: Running a command locally automatically loads `.env`

- **GIVEN** a `.env` file exists in the repository root with valid credentials
- **WHEN** the developer runs `npm run cli -- backup`
- **THEN** the unified CLI loads `.env` into the environment
- **AND** delegates to `scripts/backup.mjs`
- **AND** the backup script receives the credentials from `.env`

#### Scenario: Running a command in CI uses environment variables directly

- **GIVEN** the workflow runs on GitHub Actions with no `.env` file
- **AND** the required secrets are configured in the GitHub Environment
- **WHEN** the workflow runs `node scripts/cli.mjs backup`
- **THEN** the unified CLI does not fail because `.env` is absent
- **AND** delegates to `scripts/backup.mjs`
- **AND** the backup script receives credentials from the CI environment

#### Scenario: GitHub Actions workflows match the new CLI syntax

- **GIVEN** the repository defines a unified CLI at `scripts/cli.mjs`
- **WHEN** the backup, restore, tokenize, schedule-toggle, and offboard workflows execute
- **THEN** they invoke `node scripts/cli.mjs <command> [args]`
- **AND** the invoked command and arguments are identical to what a local developer would run

#### Scenario: Unified CLI routes restore commands with arguments

- **GIVEN** the developer wants to restore from tenant "acme-prod" to tenant "acme-dev"
- **WHEN** the developer runs `npm run cli -- restore acme-prod --tenant acme-prod --target acme-dev --full`
- **THEN** the unified CLI delegates to `scripts/restore.mjs`
- **AND** passes `acme-prod --tenant acme-prod --target acme-dev --full` as arguments

#### Scenario: Unified CLI routes tokenize subcommands

- **GIVEN** the developer wants to refresh vars for tenant "production"
- **WHEN** the developer runs `npm run cli -- tokenize find-tokens production --template default`
- **THEN** the unified CLI delegates to `scripts/tokenize.mjs`
- **AND** passes `find-tokens production --template default` as arguments

#### Scenario: Reduced package.json script surface

- **GIVEN** the legacy `package.json` contained over 20 specific wrapper scripts
- **WHEN** the change is applied
- **THEN** `package.json` only exposes generic entrypoints such as `cli` and `start`
- **AND** no highly specific permutations like `restore:cross-tenant` remain

#### Scenario: Unknown CLI command fails gracefully

- **GIVEN** the developer runs `npm run cli -- unknown-command`
- **WHEN** the unified CLI cannot map "unknown-command" to a script
- **THEN** it prints a helpful error message
- **AND** exits with a non-zero status code
