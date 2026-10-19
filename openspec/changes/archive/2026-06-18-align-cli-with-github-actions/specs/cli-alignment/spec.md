# Specification: CLI Alignment

## Feature: Unified CLI Entrypoint

As a developer or CI operator,
I want to run backup, restore, tokenization, and tenant-management commands through a single CLI entrypoint,
So that local execution matches GitHub Actions execution and `package.json` no longer needs per-permutation wrapper scripts.

### Background

```gherkin
Given the repository contains `.mjs` scripts in `scripts/`
And a local developer may have a `.env` file with tenant credentials
And GitHub Actions injects credentials through repository/environment secrets
```

### Scenario: Running a command locally automatically loads `.env`

```gherkin
Given a `.env` file exists in the repository root with valid credentials
When the developer runs "npm run cli -- backup"
Then the unified CLI loads `.env` into the environment
And delegates to "scripts/backup.mjs"
And the backup script receives the credentials from `.env`
```

### Scenario: Running a command in CI uses environment variables directly

```gherkin
Given the workflow runs on GitHub Actions with no `.env` file
And the required secrets are configured in the GitHub Environment
When the workflow runs "node scripts/cli.mjs backup"
Then the unified CLI does not fail because `.env` is absent
And delegates to "scripts/backup.mjs"
And the backup script receives credentials from the CI environment
```

### Scenario: GitHub Actions workflows match the new CLI syntax

```gherkin
Given the repository defines a unified CLI at "scripts/cli.mjs"
When the backup, restore, and tokenize workflows execute
Then they invoke "node scripts/cli.mjs <command> [args]"
And the invoked command and arguments are identical to what a local developer would run
```

### Scenario: Unified CLI routes restore commands with arguments

```gherkin
Given the developer wants to restore from tenant "acme-prod" to tenant "acme-dev"
When the developer runs "npm run cli -- restore acme-prod --tenant acme-prod --target acme-dev --full"
Then the unified CLI delegates to "scripts/restore.mjs"
And passes "acme-prod --tenant acme-prod --target acme-dev --full" as arguments
```

### Scenario: Unified CLI routes tokenize subcommands

```gherkin
Given the developer wants to refresh vars for tenant "production"
When the developer runs "npm run cli -- tokenize find-tokens production --template default"
Then the unified CLI delegates to "scripts/tokenize.mjs"
And passes "find-tokens production --template default" as arguments
```

### Scenario: Reduced package.json script surface

```gherkin
Given the legacy `package.json` contained over 20 specific wrapper scripts
When the change is applied
Then `package.json` only exposes generic entrypoints such as "cli" and "start"
And no highly specific permutations like "restore:cross-tenant" remain
```

### Scenario: Unknown CLI command fails gracefully

```gherkin
Given the developer runs "npm run cli -- unknown-command"
When the unified CLI cannot map "unknown-command" to a script
Then it prints a helpful error message
And exits with a non-zero status code
```
