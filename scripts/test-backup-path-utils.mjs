#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for scripts/backup-path-utils.mjs
//
// Usage: node scripts/test-backup-path-utils.mjs
// ---------------------------------------------------------------------------

import { BACKUP_DIR, backupRootPosix, backupObjectPosix } from "./backup-path-utils.mjs";

console.log("Testing backup-path-utils.mjs...\n");

let allPassed = true;

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`PASS: ${message}`);
  } else {
    console.error(`FAIL: ${message}`);
    console.error(`  Expected: ${expected}`);
    console.error(`  Got:      ${actual}`);
    allPassed = false;
  }
}

try {
  // Test BACKUP_DIR constant
  assertEqual(BACKUP_DIR, "backups", "BACKUP_DIR constant is correct");

  // Test backupRootPosix function
  assertEqual(backupRootPosix(), "backups", "backupRootPosix returns correct directory");

  // Test backupObjectPosix function
  assertEqual(
    backupObjectPosix("rules", "rule_1"),
    "backups/rules/rule_1.json",
    "backupObjectPosix constructs valid path for regular type and id"
  );

  assertEqual(
    backupObjectPosix("pages", "login-page-123"),
    "backups/pages/login-page-123.json",
    "backupObjectPosix constructs valid path with dashes"
  );

} catch (err) {
  console.error(`FAIL: Error running tests: ${err.message}`);
  console.error(err.stack);
  allPassed = false;
}

console.log("");
if (allPassed) {
  console.log("All tests passed!");
  process.exit(0);
} else {
  console.error("Some tests failed!");
  process.exit(1);
}
