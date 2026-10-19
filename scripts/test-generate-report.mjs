#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for scripts/generate-report.mjs
//
// Usage: node scripts/test-generate-report.mjs
// ---------------------------------------------------------------------------

import { generateReport, normalizeResults, loadAttemptStatusesFromResults, parseAttemptStatusesFromReport } from "./generate-report.mjs";
import { assert, assertDeepEqual, finalizeTests } from "./test-utils.mjs";

console.log("Testing generate-report.mjs...\n");

const now = new Date("2026-06-19T12:00:00Z");

const registry = {
  tenants: [
    {
      name: "company12926-poc",
      active: true,
      schedule: "0 6 * * *",
      hostname: "company12926-poc.identitynow-demo.com",
      description: "POC tenant (6 AM UTC)",
    },
    {
      name: "company21280-poc",
      active: true,
      schedule: "0 7 * * *",
      hostname: "company21280-poc.identitynow-demo.com",
      description: "POC tenant (7 AM UTC)",
    },
    {
      name: "axa",
      active: true,
      hostname: "axa.identitynow-demo.com",
    },
  ],
};

// ---------------------------------------------------------------------------
// normalizeResults
// ---------------------------------------------------------------------------
{
  assertDeepEqual(
    normalizeResults(null),
    [],
    "normalizeResults: null returns empty array"
  );
  assertDeepEqual(
    normalizeResults('["a","b"]'),
    ["a", "b"],
    "normalizeResults: array passthrough"
  );
  assertDeepEqual(
    normalizeResults('{"0":"{\\"x\\":1}","1":"{\\"x\\":2}"}'),
    [{ x: 1 }, { x: 2 }],
    "normalizeResults: object-keyed JSON strings"
  );
}

// ---------------------------------------------------------------------------
// All tenants backed up successfully
// ---------------------------------------------------------------------------
{
  const resultsJson = JSON.stringify([
    {
      tenant: "company12926-poc",
      status: "backed-up",
      tag: "company12926-poc/2026-06-19_06-00-00",
      schedule: "0 6 * * *",
      size: 12345,
      files: 100,
      added: 2,
      deleted: 0,
      modified: 1,
    },
    {
      tenant: "company21280-poc",
      status: "backed-up",
      tag: "company21280-poc/2026-06-19_07-00-00",
      schedule: "0 7 * * *",
      size: 67890,
      files: 200,
      added: 0,
      deleted: 0,
      modified: 0,
    },
  ]);
  const md = generateReport(resultsJson, registry, now, { scheduledCount: 2 });
  assert(md.includes("## 🔄 ISC Backup Report — 2026-06-19"), "Header includes run date");
  assert(md.includes("| company12926-poc | backed-up | 0 6 * * * | 2026-06-20 06:00 UTC | company12926-poc.identitynow-demo.com | company12926-poc/2026-06-19_06-00-00 |"), "Successful tenant row includes hostname and next backup");
  assert(md.includes("**Total tenants processed:** 2"), "Total processed count");
}

// ---------------------------------------------------------------------------
// Mixed status: one unchanged, one failed
// ---------------------------------------------------------------------------
{
  const resultsJson = JSON.stringify([
    {
      tenant: "company12926-poc",
      status: "unchanged",
      tag: "",
      schedule: "0 6 * * *",
      size: 0,
      files: 0,
      added: 0,
      deleted: 0,
      modified: 0,
    },
    {
      tenant: "company21280-poc",
      status: "failed",
      tag: "",
      schedule: "0 7 * * *",
      size: 0,
      files: 0,
      added: 0,
      deleted: 0,
      modified: 0,
    },
  ]);
  const md = generateReport(resultsJson, registry, now, { scheduledCount: 2 });
  assert(md.includes("| company12926-poc | unchanged |"), "Unchanged tenant row");
  assert(md.includes("| company21280-poc | failed |"), "Failed tenant row");
  assert(md.includes("| - | 0 | 0 | +0 | -0 | ~0 |"), "Empty stats shown as - for missing tag");
}

// ---------------------------------------------------------------------------
// Skipped tenants (active but schedule did not match)
// ---------------------------------------------------------------------------
{
  const resultsJson = JSON.stringify([]);
  const allActiveJson = JSON.stringify({
    include: [
      { tenant: "company12926-poc", schedule: "0 6 * * *" },
      { tenant: "company21280-poc", schedule: "0 7 * * *" },
      { tenant: "axa", schedule: "daily" },
    ],
  });
  const scheduleMatchJson = JSON.stringify({
    include: [
      { tenant: "company12926-poc", schedule: "0 6 * * *" },
    ],
  });
  const md = generateReport(resultsJson, registry, now, {
    allActiveJson,
    scheduleMatchJson,
    scheduledCount: 0,
  });
  assert(md.includes("| company21280-poc | skipped | 0 7 * * * |"), "Skipped tenant row for company21280-poc");
  assert(md.includes("| axa | skipped | daily | daily | axa.identitynow-demo.com |"), "Skipped tenant row for axa (daily default)");
}

// ---------------------------------------------------------------------------
// Up-to-date tenants (schedule matched but already backed up)
// ---------------------------------------------------------------------------
{
  const resultsJson = JSON.stringify([
    {
      tenant: "company12926-poc",
      status: "backed-up",
      tag: "company12926-poc/2026-06-19_06-00-00",
      schedule: "0 6 * * *",
      size: 0,
      files: 0,
      added: 0,
      deleted: 0,
      modified: 0,
    },
  ]);
  const allActiveJson = JSON.stringify({
    include: [
      { tenant: "company12926-poc", schedule: "0 6 * * *" },
      { tenant: "company21280-poc", schedule: "0 7 * * *" },
    ],
  });
  const scheduleMatchJson = JSON.stringify({
    include: [
      { tenant: "company12926-poc", schedule: "0 6 * * *" },
      { tenant: "company21280-poc", schedule: "0 7 * * *" },
    ],
  });
  const md = generateReport(resultsJson, registry, now, {
    allActiveJson,
    scheduleMatchJson,
    scheduledCount: 1,
  });
  assert(md.includes("| company21280-poc | up-to-date | 0 7 * * *"), "Up-to-date tenant row for company21280-poc");
}

// ---------------------------------------------------------------------------
// Missing hostname shows em-dash
// ---------------------------------------------------------------------------
{
  const resultsJson = JSON.stringify([
    {
      tenant: "no-host",
      status: "backed-up",
      tag: "no-host/2026-06-19_06-00-00",
      schedule: "0 6 * * *",
      size: 0,
      files: 0,
      added: 0,
      deleted: 0,
      modified: 0,
    },
  ]);
  const md = generateReport(resultsJson, registry, now, { scheduledCount: 1 });
  assert(md.includes("| no-host | backed-up | 0 6 * * * | 2026-06-20 06:00 UTC | — | no-host/"), "Missing hostname shown as em-dash");
}

// ---------------------------------------------------------------------------
// Daily-default tenant shows literal "daily"
// ---------------------------------------------------------------------------
{
  const resultsJson = JSON.stringify([
    {
      tenant: "axa",
      status: "backed-up",
      tag: "axa/2026-06-19_06-00-00",
      schedule: "daily",
      size: 0,
      files: 0,
      added: 0,
      deleted: 0,
      modified: 0,
    },
  ]);
  const md = generateReport(resultsJson, registry, now, { scheduledCount: 1 });
  assert(md.includes("| axa | backed-up | daily | daily | axa.identitynow-demo.com |"), "Daily-default tenant shows literal 'daily' for next backup");
}

// ---------------------------------------------------------------------------
// Pipe character in hostname is escaped
// ---------------------------------------------------------------------------
{
  const regWithPipe = {
    tenants: [{ name: "noisy", active: true, schedule: "0 6 * * *", hostname: "host | example.com" }],
  };
  const resultsJson = JSON.stringify([
    {
      tenant: "noisy",
      status: "backed-up",
      tag: "noisy/2026-06-19_06-00-00",
      schedule: "0 6 * * *",
      size: 0,
      files: 0,
      added: 0,
      deleted: 0,
      modified: 0,
    },
  ]);
  const md = generateReport(resultsJson, regWithPipe, now, { scheduledCount: 1 });
  assert(md.includes("host \\| example.com"), "Pipe character in hostname is escaped");
}

// ---------------------------------------------------------------------------
// Tenants already in results are not duplicated as skipped
// ---------------------------------------------------------------------------
{
  const resultsJson = JSON.stringify([
    {
      tenant: "axa",
      status: "failed",
      tag: "",
      schedule: "0 0 * * *",
      size: 1756866,
      files: 337,
      added: 336,
      deleted: 0,
      modified: 0,
    },
  ]);
  const allActiveJson = JSON.stringify({
    include: [
      { tenant: "company12926-poc", schedule: "0 6 * * *" },
      { tenant: "axa", schedule: "0 0 * * *" },
    ],
  });
  const scheduleMatchJson = JSON.stringify({ include: [] });
  const md = generateReport(resultsJson, registry, now, {
    allActiveJson,
    scheduleMatchJson,
    scheduledCount: 8,
  });
  const axaRows = md.split("\n").filter((line) => line.includes("| axa |"));
  assert(axaRows.length === 1, "Tenant in results is not duplicated as skipped");
  assert(axaRows[0].includes("| failed |"), "Result row keeps failed status");
}

// ---------------------------------------------------------------------------
// loadAttemptStatusesFromResults
// ---------------------------------------------------------------------------
{
  const statuses = loadAttemptStatusesFromResults(
    JSON.stringify([
      { tenant: "ksb", status: "failed" },
      { tenant: "fernando", status: "unchanged" },
    ])
  );
  assert(statuses.ksb === "failed", "loadAttemptStatusesFromResults maps failed tenant");
  assert(statuses.fernando === "unchanged", "loadAttemptStatusesFromResults maps unchanged tenant");
}

// ---------------------------------------------------------------------------
// parseAttemptStatusesFromReport
// ---------------------------------------------------------------------------
{
  const md = generateReport(
    JSON.stringify([
      { tenant: "ksb", status: "failed", schedule: "0 0 * * *", size: 1, files: 1, added: 0, deleted: 0, modified: 0 },
      { tenant: "fernando", status: "unchanged", schedule: "0 0 * * *", size: 1, files: 1, added: 0, deleted: 0, modified: 0 },
    ]),
    registry,
    now,
    { scheduledCount: 2 }
  );
  const statuses = parseAttemptStatusesFromReport(md);
  assert(statuses.ksb === "failed", "parseAttemptStatusesFromReport reads failed status");
  assert(statuses.fernando === "unchanged", "parseAttemptStatusesFromReport reads unchanged status");
}

finalizeTests();

