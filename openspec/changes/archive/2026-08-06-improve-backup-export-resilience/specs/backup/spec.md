## MODIFIED Requirements

### Requirement: Poll export job until complete

The backup script SHALL poll the export job status at 10-second intervals until complete or until the configured poll budget is exhausted. On retryable transient statuses (including `FAILED_EXTERNAL_COMMUNICATION`), the script SHALL create a new export job and poll again, up to a configurable maximum number of export attempts (default 3). The script SHALL fail on non-retryable terminal statuses (`FAILED`, `CANCELLED`) after retries are exhausted.

#### Scenario: Export completes within timeout

- **GIVEN** an export job is created
- **WHEN** the job status becomes COMPLETE
- **THEN** polling stops and download proceeds

#### Scenario: Export failure aborts backup

- **GIVEN** an export job status becomes FAILED with a non-retryable error
- **WHEN** polling detects the failure after all export attempts are exhausted
- **THEN** the script exits with a non-zero code and error details

#### Scenario: Transient communication failure retries export

- **GIVEN** an export job returns status `FAILED_EXTERNAL_COMMUNICATION` on every poll until attempt limit
- **AND** `maxExportAttempts` is 3
- **WHEN** the second export job reaches COMPLETE
- **THEN** polling stops and download proceeds
- **AND** the log records the retry count and previous job IDs

#### Scenario: Per-tenant poll budget override

- **GIVEN** tenant "axa" has `exportPollMinutes: 20` in tenants.yaml
- **WHEN** backup runs for "axa"
- **THEN** the poll budget allows up to 20 minutes before failing a single export attempt
