# Tokenization

## Purpose

Environment-specific value tokenization for cross-tenant configuration promotion via templates and vars files.

## Requirements

### Requirement: Create tokenized templates from tenant backup

The system SHALL provide a CLI command to read a tenant's backup, replace environment-specific fields with `{{UPPER_SNAKE_CASE}}` tokens, and write output to `templates/<name>/` plus seed `vars/<tenant>.vars.yaml`.

#### Scenario: Create template from existing backup

- **GIVEN** backup data exists under `backups/beta-15156/`
- **WHEN** an operator runs `npm run cli -- tokenize create-template beta-15156 --template default`
- **THEN** tokenized JSON files are written under `templates/default/`
- **AND** `vars/beta-15156.vars.yaml` is created with the original values for each token

### Requirement: Token paths are configurable without code changes

The system SHALL read tokenizable field paths from `token-paths.json` at the repository root so operators can extend coverage for custom connector types.

#### Scenario: Custom SOURCE field tokenized via config

- **GIVEN** `token-paths.json` includes path `["object", "connectorAttributes", "apiEndpoint"]` for type SOURCE
- **WHEN** create-template runs against a SOURCE object containing `apiEndpoint`
- **THEN** the field value is replaced with a `{{TOKEN}}` placeholder and recorded in the vars file

### Requirement: Find tokens for a target tenant by name matching

The system SHALL match template files to a target tenant's backup objects by `self.type` and `self.name` and extract token values into a vars file.

#### Scenario: Populate production vars from template

- **GIVEN** templates exist under `templates/default/`
- **AND** backup data exists for tenant "production"
- **WHEN** an operator runs `npm run cli -- tokenize find-tokens production --template default`
- **THEN** `vars/production.vars.yaml` is written with values extracted from matched objects
- **AND** warnings are printed for templates with no matching object in the target backup
