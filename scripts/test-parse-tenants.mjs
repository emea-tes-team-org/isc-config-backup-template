#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for scripts/parse-tenants.mjs
//
// Usage: node scripts/test-parse-tenants.mjs
// ---------------------------------------------------------------------------

import { writeFileSync, unlinkSync, existsSync, readFileSync } from "fs";
import { execSync } from "child_process";
import {
  parseTagTimestamp,
  buildLatestTagMapFromTags,
  checkBackupPendingState,
  getLatestBranchBackupTime,
  isWithinScheduleWindow,
} from "./parse-tenants.mjs";
import { assert, finalizeTests } from "./test-utils.mjs";

const PARSER = "node scripts/parse-tenants.mjs";

console.log("Testing parse-tenants.mjs...\n");

// Unit tests: parseTagTimestamp
{
  const ts = parseTagTimestamp("mediolanum/2026-08-03_00-00-01");
  assert(
    ts instanceof Date && ts.toISOString() === "2026-08-03T00:00:01.000Z",
    "parseTagTimestamp parses valid tag name"
  );
  assert(parseTagTimestamp("invalid-tag") === null, "parseTagTimestamp returns null for invalid tag");
}

// Regression: newer name-embedded timestamp wins over older (creatordate order irrelevant)
{
  const tagsInCreatordateOrder = [
    "mediolanum/2026-08-03_00-00-01",
    "mediolanum/2026-07-22_21-54-46",
  ];
  const map = buildLatestTagMapFromTags(tagsInCreatordateOrder);
  assert(
    map.get("mediolanum") === "mediolanum/2026-08-03_00-00-01",
    "Latest tag selected by name timestamp not creatordate"
  );
}

// backup-pending-check scenarios (fixed reference times)
{
  const tenant = (name, schedule) => ({ name, schedule: schedule ?? "0 6 * * *" });
  const utc = (iso) => new Date(iso);

  assert(
    checkBackupPendingState(tenant("company12926-poc"), utc("2024-01-01T06:00:00Z"), null).pending === true,
    "Tenant with no prior backup is pending"
  );

  assert(
    checkBackupPendingState(
      tenant("company12926-poc"),
      utc("2024-01-01T06:15:00Z"),
      utc("2024-01-01T06:00:00Z")
    ).pending === false,
    "Tenant already backed up today after scheduled time is not pending"
  );

  assert(
    checkBackupPendingState(
      tenant("company12926-poc"),
      utc("2024-01-01T06:00:00Z"),
      utc("2023-12-31T06:00:00Z")
    ).pending === true,
    "Tenant backed up yesterday is pending"
  );

  assert(
    checkBackupPendingState(tenant("company12926-poc"), utc("2024-01-01T05:59:00Z"), null).pending === false,
    "Pending check respects schedule window (before-window)"
  );

  assert(
    checkBackupPendingState(
      tenant("mediolanum", "0 0 * * *"),
      utc("2026-08-03T14:00:00Z"),
      parseTagTimestamp("mediolanum/2026-08-03_13-30-20")
    ).pending === false,
    "Latest name-embedded backup excludes tenant from pending (mediolanum scenario)"
  );

  const branchOnly = checkBackupPendingState(
    tenant("acme-prod", "0 0 * * *"),
    utc("2026-08-06T01:30:00Z"),
    null,
    utc("2026-08-06T01:20:00Z")
  );
  assert(
    branchOnly.pending === true && branchOnly.reason === "missing-tag",
    "Branch commit without matching tag is pending (missing-tag)"
  );

  const tagged = checkBackupPendingState(
    tenant("acme-prod", "0 0 * * *"),
    utc("2026-08-06T01:30:00Z"),
    utc("2026-08-06T01:25:00Z"),
    utc("2026-08-06T01:20:00Z")
  );
  assert(
    tagged.pending === false && tagged.reason === "up-to-date",
    "Tag present after scheduled time is not pending even with branch commit"
  );
}

// getLatestBranchBackupTime helper
{
  const mockGit = () => "2026-08-06T01:20:00Z\n";
  const ts = getLatestBranchBackupTime("acme-prod", mockGit);
  assert(
    ts instanceof Date && ts.toISOString() === "2026-08-06T01:20:00.000Z",
    "getLatestBranchBackupTime parses git log commit timestamp"
  );
  assert(
    getLatestBranchBackupTime("missing", () => "") === null,
    "getLatestBranchBackupTime returns null when no matching commit"
  );
}

// Schedule window: retry-band inclusion, not exact-minute match
{
  const schedule = "0 0 * * *";
  assert(
    isWithinScheduleWindow(schedule, new Date("2026-08-05T00:00:00Z")) === true,
    "Schedule window includes exact scheduled time"
  );
  assert(
    isWithinScheduleWindow(schedule, new Date("2026-08-05T00:15:00Z")) === true,
    "Schedule window includes retry at 00:15"
  );
  assert(
    isWithinScheduleWindow(schedule, new Date("2026-08-05T01:18:00Z")) === true,
    "Schedule window includes delayed GitHub Actions run at 01:18"
  );
  assert(
    isWithinScheduleWindow(schedule, new Date("2026-08-05T01:45:00Z")) === true,
    "Schedule window includes last retry cron at 01:45"
  );
  assert(
    isWithinScheduleWindow(schedule, new Date("2026-08-05T01:46:00Z")) === true,
    "Schedule window includes delayed GitHub Actions run at 01:46"
  );
  assert(
    isWithinScheduleWindow(schedule, new Date("2026-08-05T04:07:00Z")) === true,
    "Schedule window includes heavily delayed GitHub Actions run at 04:07"
  );
  assert(
    isWithinScheduleWindow(schedule, new Date("2026-08-05T06:01:00Z")) === false,
    "Schedule window excludes time after GitHub delay buffer"
  );
  assert(
    isWithinScheduleWindow(schedule, new Date("2026-08-05T14:00:00Z")) === false,
    "Schedule window excludes afternoon runs"
  );
  assert(
    isWithinScheduleWindow("0 6 * * 1", new Date("2026-06-22T06:15:00Z")) === true,
    "Weekly schedule window includes retry after Monday 06:00"
  );
  assert(
    isWithinScheduleWindow("0 6 * * 1", new Date("2026-06-23T06:15:00Z")) === false,
    "Weekly schedule window excludes Tuesday even at same clock time"
  );
}

// Backup original
const originalExists = existsSync("tenants.yaml");
let originalContent = null;
if (originalExists) {
  originalContent = readFileSync("tenants.yaml", "utf-8");
  unlinkSync("tenants.yaml");
}

// Test: Parse tenant with description and hostname
writeFileSync("tenants.yaml", `tenants:
  - name: company21280-poc
    active: true
    description: "Fernando's tenant"
    hostname: company21280-poc.identitynow-demo.com
  - name: company12926-poc
    active: false
`);

try {
  const output = execSync(`${PARSER} --all`, { encoding: "utf-8" });
  const result = JSON.parse(output);
  const expected = {
    include: [
      { tenant: "company21280-poc", branch: "company21280-poc", environment: "company21280-poc", schedule: "0 0 * * *", hostname: "company21280-poc.identitynow-demo.com", reason: "", exportPollMinutes: 10, jobTimeoutMinutes: 15 },
      { tenant: "company12926-poc", branch: "company12926-poc", environment: "company12926-poc", schedule: "0 0 * * *", hostname: "", reason: "", exportPollMinutes: 10, jobTimeoutMinutes: 15 },
    ],
  };
  if (JSON.stringify(result) === JSON.stringify(expected)) {
    console.log("PASS: Matrix output excludes description field but includes hostname");
  } else {
    console.error("FAIL: Matrix output mismatch");
    console.error(`  Expected: ${JSON.stringify(expected)}`);
    console.error(`  Got:      ${JSON.stringify(result)}`);
    allPassed = false;
  }

  // Verify count
  const countOutput = execSync(`${PARSER} --all --count`, { encoding: "utf-8" }).trim();
  if (countOutput === "2") {
    console.log("PASS: Count includes all tenants");
  } else {
    console.error(`FAIL: Count expected 2, got ${countOutput}`);
    allPassed = false;
  }

  // Verify active-only filtering still works
  const activeOutput = execSync(`${PARSER} --active-only`, { encoding: "utf-8" });
  const activeResult = JSON.parse(activeOutput);
  if (activeResult.include.length === 1 && activeResult.include[0].tenant === "company21280-poc") {
    console.log("PASS: Active-only filtering works with description field");
  } else {
    console.error("FAIL: Active-only filtering broken");
    allPassed = false;
  }

  writeFileSync("tenants.yaml", `tenants:
  - name: axa
    active: true
    exportPollMinutes: 20
    jobTimeoutMinutes: 25
`);
  const axaOutput = execSync(`${PARSER} --tenant axa --all`, { encoding: "utf-8" });
  const axaResult = JSON.parse(axaOutput);
  assert(
    axaResult.include.length === 1 &&
      axaResult.include[0].exportPollMinutes === 20 &&
      axaResult.include[0].jobTimeoutMinutes === 25,
    "parse-tenants includes per-tenant timeout fields in matrix output"
  );
} catch (err) {
  console.error(`FAIL: Error running parser: ${err.message}`);
  allPassed = false;
} finally {
  unlinkSync("tenants.yaml");
  if (originalContent !== null) {
    writeFileSync("tenants.yaml", originalContent);
  }
}

finalizeTests();

