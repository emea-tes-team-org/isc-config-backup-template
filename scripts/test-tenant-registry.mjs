#!/usr/bin/env node
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from "fs";
import { loadRegistry, DEFAULT_REGISTRY_FILE, DEFAULT_EXPORT_POLL_MINUTES, DEFAULT_JOB_TIMEOUT_MINUTES, resolveExportPollMinutes, resolveJobTimeoutMinutes, getTenantBackupSettings } from "./tenant-registry.mjs";
import { assert, assertDeepEqual, finalizeTests } from "./test-utils.mjs";

console.log("Testing tenant-registry.mjs...\n");

const TEMP_FILE = "temp-test-tenants.yaml";

try {
  // Test 0: Verify DEFAULT_REGISTRY_FILE export
  assert(DEFAULT_REGISTRY_FILE === "tenants.yaml", "Exports correct DEFAULT_REGISTRY_FILE");

  // Test 1: Missing file
  const missingResult = loadRegistry("does-not-exist.yaml");
  assertDeepEqual(missingResult, { tenants: [] }, "Missing file returns empty registry");

  // Test 2: Valid parsing
  writeFileSync(TEMP_FILE, `
# Some comment
tenants:
  - name: tenant-a
    active: true
    description: "My first tenant"
    url: https://example.com
  - name: tenant-b
    active: false
    description: No quotes
`);

  const validResult = loadRegistry(TEMP_FILE);
  const expectedValid = {
    tenants: [
      {
        name: "tenant-a",
        active: true,
        description: "My first tenant",
        url: "https://example.com"
      },
      {
        name: "tenant-b",
        active: false,
        description: "No quotes"
      }
    ]
  };
  assertDeepEqual(validResult, expectedValid, "Successfully parses valid yaml with quotes and booleans");

  // Test 3: Error parsing (mocking process.exit)
  const originalExit = process.exit;
  const originalError = console.error;
  let exitCode = null;
  let errorMessage = "";

  process.exit = (code) => { exitCode = code; };
  console.error = (msg) => { errorMessage = msg; };

  const tempDir = "temp-dir-for-test-" + Date.now();
  mkdirSync(tempDir);

  try {
    loadRegistry(tempDir);
  } finally {
    process.exit = originalExit;
    console.error = originalError;
    rmdirSync(tempDir);
  }

  assert(exitCode === 1, "Calls process.exit(1) on read error");
  assert(errorMessage.includes(`could not parse ${tempDir}`), "Logs correct error message");

  // Test 4: resolveExportPollMinutes
  assert(resolveExportPollMinutes({}) === DEFAULT_EXPORT_POLL_MINUTES, "resolveExportPollMinutes defaults to DEFAULT_EXPORT_POLL_MINUTES when missing");
  assert(resolveExportPollMinutes({ exportPollMinutes: 0 }) === DEFAULT_EXPORT_POLL_MINUTES, "resolveExportPollMinutes defaults to DEFAULT_EXPORT_POLL_MINUTES when 0");
  assert(resolveExportPollMinutes({ exportPollMinutes: -5 }) === DEFAULT_EXPORT_POLL_MINUTES, "resolveExportPollMinutes defaults to DEFAULT_EXPORT_POLL_MINUTES when negative");
  assert(resolveExportPollMinutes({ exportPollMinutes: "20" }) === DEFAULT_EXPORT_POLL_MINUTES, "resolveExportPollMinutes defaults to DEFAULT_EXPORT_POLL_MINUTES when string");
  assert(resolveExportPollMinutes({ exportPollMinutes: 20 }) === 20, "resolveExportPollMinutes returns explicit valid value");

  // Test 5: resolveJobTimeoutMinutes
  assert(resolveJobTimeoutMinutes({}) === DEFAULT_JOB_TIMEOUT_MINUTES, "resolveJobTimeoutMinutes defaults to DEFAULT_JOB_TIMEOUT_MINUTES when missing");
  assert(resolveJobTimeoutMinutes({ jobTimeoutMinutes: 0 }) === DEFAULT_JOB_TIMEOUT_MINUTES, "resolveJobTimeoutMinutes defaults to DEFAULT_JOB_TIMEOUT_MINUTES when 0");
  assert(resolveJobTimeoutMinutes({ jobTimeoutMinutes: -5 }) === DEFAULT_JOB_TIMEOUT_MINUTES, "resolveJobTimeoutMinutes defaults to DEFAULT_JOB_TIMEOUT_MINUTES when negative");
  assert(resolveJobTimeoutMinutes({ jobTimeoutMinutes: "30" }) === DEFAULT_JOB_TIMEOUT_MINUTES, "resolveJobTimeoutMinutes defaults to DEFAULT_JOB_TIMEOUT_MINUTES when string");
  assert(resolveJobTimeoutMinutes({ jobTimeoutMinutes: 30 }) === 30, "resolveJobTimeoutMinutes returns explicit valid value");

  // Test 6: getTenantBackupSettings
  const mockRegistry = {
    tenants: [
      { name: "tenant-default" },
      { name: "tenant-custom", exportPollMinutes: 25, jobTimeoutMinutes: 45 }
    ]
  };

  assertDeepEqual(
    getTenantBackupSettings(mockRegistry, "tenant-default"),
    { exportPollMinutes: DEFAULT_EXPORT_POLL_MINUTES, jobTimeoutMinutes: DEFAULT_JOB_TIMEOUT_MINUTES },
    "getTenantBackupSettings returns defaults for missing properties"
  );

  assertDeepEqual(
    getTenantBackupSettings(mockRegistry, "tenant-custom"),
    { exportPollMinutes: 25, jobTimeoutMinutes: 45 },
    "getTenantBackupSettings returns custom properties"
  );


} finally {
  try {
    unlinkSync(TEMP_FILE);
  } catch (e) {
    // Ignore cleanup errors
  }
}

finalizeTests();
