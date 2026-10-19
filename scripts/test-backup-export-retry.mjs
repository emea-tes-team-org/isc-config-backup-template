#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for export retry logic in scripts/backup.mjs
//
// Usage: node scripts/test-backup-export-retry.mjs
// ---------------------------------------------------------------------------

import { assert, finalizeTests } from "./test-utils.mjs";

process.env.TENANT_URL = "https://test.example.com";
process.env.CLIENT_ID = "test-client";
process.env.CLIENT_SECRET = "test-secret";
process.env.TENANT_NAME = "test-tenant";

const {
  ExportRetryableError,
  pollExport,
  runExportWithRetries,
  resolvePollConfig,
  DEFAULT_MAX_EXPORT_ATTEMPTS,
  DEFAULT_POLL_INTERVAL_MS,
  RETRYABLE_EXPORT_STATUSES,
} = await import("./backup.mjs");

console.log("Testing backup export retry...\n");

// RETRYABLE_EXPORT_STATUSES definition
{
  assert(RETRYABLE_EXPORT_STATUSES instanceof Set, "RETRYABLE_EXPORT_STATUSES is a Set");
  assert(RETRYABLE_EXPORT_STATUSES.has("FAILED_EXTERNAL_COMMUNICATION"), "RETRYABLE_EXPORT_STATUSES includes FAILED_EXTERNAL_COMMUNICATION");
}

// resolvePollConfig defaults
{
  const config = resolvePollConfig({}, "unknown-tenant");
  assert(config.exportPollMinutes === 10, "resolvePollConfig defaults exportPollMinutes to 10");
  assert(config.maxPollAttempts === 60, "resolvePollConfig default poll budget is 60 attempts");
  assert(config.maxExportAttempts === DEFAULT_MAX_EXPORT_ATTEMPTS, "resolvePollConfig default max export attempts is 3");
  assert(config.pollIntervalMs === DEFAULT_POLL_INTERVAL_MS, "resolvePollConfig defaults pollIntervalMs to DEFAULT_POLL_INTERVAL_MS");
}

// ExportRetryableError properties
{
  const err = new ExportRetryableError("FAILED_EXTERNAL_COMMUNICATION", "job-123", { retry: true });
  assert(err instanceof Error, "ExportRetryableError inherits from Error");
  assert(err.name === "ExportRetryableError", "ExportRetryableError has correct name");
  assert(err.message === "Export status FAILED_EXTERNAL_COMMUNICATION (job job-123)", "ExportRetryableError has correct message");
  assert(err.status === "FAILED_EXTERNAL_COMMUNICATION", "ExportRetryableError stores status");
  assert(err.jobId === "job-123", "ExportRetryableError stores jobId");
  assert(err.data?.retry === true, "ExportRetryableError stores arbitrary data");
}

// resolvePollConfig env override
{
  const config = resolvePollConfig({ EXPORT_POLL_MINUTES: "20", MAX_EXPORT_ATTEMPTS: "2", POLL_INTERVAL_MS: "5000" }, "axa");
  assert(config.exportPollMinutes === 20, "resolvePollConfig honors EXPORT_POLL_MINUTES env");
  assert(config.maxPollAttempts === 240, "resolvePollConfig scales poll attempts with minutes");
  assert(config.maxExportAttempts === 2, "resolvePollConfig honors MAX_EXPORT_ATTEMPTS env");
  assert(config.pollIntervalMs === 5000, "resolvePollConfig honors POLL_INTERVAL_MS env");
}

// resolvePollConfig handles invalid numeric EXPORT_POLL_MINUTES
{
  const config = resolvePollConfig({ EXPORT_POLL_MINUTES: "not-a-number" }, "unknown-tenant");
  assert(config.exportPollMinutes === 10, "resolvePollConfig falls back to default when EXPORT_POLL_MINUTES is invalid");
}

// resolvePollConfig handles invalid/missing POLL_INTERVAL_MS
{
  const config = resolvePollConfig({ POLL_INTERVAL_MS: "invalid" }, "unknown-tenant");
  assert(config.pollIntervalMs === 10000, "resolvePollConfig falls back to DEFAULT_POLL_INTERVAL_MS when invalid");
}

// resolvePollConfig handles invalid/negative MAX_EXPORT_ATTEMPTS
{
  const config1 = resolvePollConfig({ MAX_EXPORT_ATTEMPTS: "invalid" }, "unknown-tenant");
  assert(config1.maxExportAttempts === DEFAULT_MAX_EXPORT_ATTEMPTS, "resolvePollConfig uses default for invalid max attempts");

  const config2 = resolvePollConfig({ MAX_EXPORT_ATTEMPTS: "0" }, "unknown-tenant");
  assert(config2.maxExportAttempts === DEFAULT_MAX_EXPORT_ATTEMPTS, "resolvePollConfig uses default for < 1 max attempts");
}

// resolvePollConfig floors maxPollAttempts to 1
{
  const config = resolvePollConfig({ EXPORT_POLL_MINUTES: "0", POLL_INTERVAL_MS: "5000" }, "unknown-tenant");
  assert(config.maxPollAttempts === 1, "resolvePollConfig floors maxPollAttempts at 1");
}

// pollExport completes on COMPLETE
{
  let calls = 0;
  const deps = {
    apiCall: async () => {
      calls++;
      return { status: calls === 1 ? "IN_PROGRESS" : "COMPLETE" };
    },
    sleep: async () => {},
  };

  await pollExport("job-1", { maxPollAttempts: 5, pollIntervalMs: 10 }, deps);
  assert(calls === 2, "pollExport stops after COMPLETE");
}

// pollExport throws ExportRetryableError on FAILED_EXTERNAL_COMMUNICATION
{
  const deps = {
    apiCall: async () => ({ status: "FAILED_EXTERNAL_COMMUNICATION" }),
    sleep: async () => {},
  };

  let caught = null;
  try {
    await pollExport("job-bad", { maxPollAttempts: 5, pollIntervalMs: 10 }, deps);
  } catch (err) {
    caught = err;
  }
  assert(caught instanceof ExportRetryableError, "pollExport throws ExportRetryableError for communication failure");
  assert(caught?.jobId === "job-bad", "ExportRetryableError includes job ID");
}

// pollExport fails on non-retryable FAILED
{
  const deps = {
    apiCall: async () => ({ status: "FAILED", errors: ["boom"] }),
    sleep: async () => {},
  };

  let message = "";
  try {
    await pollExport("job-fail", { maxPollAttempts: 3, pollIntervalMs: 10 }, deps);
  } catch (err) {
    message = err.message;
  }
  assert(message.includes("Export failed"), "pollExport fails immediately on FAILED");
}

// runExportWithRetries retries communication failure then succeeds
{
  const statusesByJob = {
    "job-1": ["FAILED_EXTERNAL_COMMUNICATION"],
    "job-2": ["IN_PROGRESS", "COMPLETE"],
  };
  const createdJobs = [];

  const deps = {
    createExport: async () => {
      const jobId = createdJobs.length === 0 ? "job-1" : "job-2";
      createdJobs.push(jobId);
      return jobId;
    },
    apiCall: async (_method, path) => {
      const jobId = path.split("/").pop();
      const queue = statusesByJob[jobId];
      const status = queue.shift() ?? "COMPLETE";
      return { status };
    },
    sleep: async () => {},
  };

  const jobId = await runExportWithRetries(
    ["ROLE"],
    { maxExportAttempts: 3, maxPollAttempts: 5, pollIntervalMs: 10 },
    deps
  );
  assert(jobId === "job-2", "runExportWithRetries returns successful job ID");
  assert(createdJobs.length === 2, "runExportWithRetries creates second export after retryable failure");
}

// runExportWithRetries exhausts attempts on persistent communication failure
{
  let createCount = 0;
  const deps = {
    createExport: async () => {
      createCount++;
      return `job-${createCount}`;
    },
    apiCall: async () => ({ status: "FAILED_EXTERNAL_COMMUNICATION" }),
    sleep: async () => {},
  };

  let caught = null;
  try {
    await runExportWithRetries(
      ["ROLE"],
      { maxExportAttempts: 3, maxPollAttempts: 2, pollIntervalMs: 10 },
      deps
    );
  } catch (err) {
    caught = err;
  }
  assert(caught instanceof ExportRetryableError, "runExportWithRetries fails after max export attempts");
  assert(createCount === 3, "runExportWithRetries attempts three exports before failing");
}

finalizeTests();
