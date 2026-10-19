## 0. Setup

- [x] 0.1 Ensure tests (if any) and basic imports still work. No extra build steps required for `.mjs`.

## 1. Specification & Design (BLOCKED on specs completion)
- [x] 1.1 Complete `specs/cli-alignment/spec.md` with concrete Gherkin scenarios using the `gherkin-authoring` skill.
- [x] 1.2 Finalize `design.md` decisions (manual parsing approach selected).
- [x] 1.3 Approve ADR `adr/0003-align-cli-with-github-actions.md`.

## 2. Implementation
- [x] 2.1 Implement the unified CLI router/wrapper.
- [x] 2.2 Update `.github/workflows/*.yml` to use the unified syntax if applicable, ensuring parity.
- [x] 2.3 Remove legacy scripts from `package.json`.
- [x] 2.4 Update `README.md` examples.

## Stop conditions

Stop and report if:
- A required CLI library (if chosen) conflicts with the current Node version or environment.
- Modifying GitHub Actions workflows breaks secret injection logic that cannot be easily adapted.

## Done criteria

- [x] `package.json` scripts block is reduced and generic.
- [x] Running the unified command locally automatically loads `.env` and succeeds.
- [x] GitHub Actions workflows still execute successfully using the aligned method.

## Maintenance notes

- Any future script additions must be integrated into the unified CLI router rather than adding a new `package.json` wrapper.
- Reviewers should ensure the CLI router gracefully handles missing `.env` files in production/CI environments.
