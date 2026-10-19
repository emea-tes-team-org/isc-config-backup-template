#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for flat backup directory layout
//
// Usage: node scripts/test-backup.mjs
// ---------------------------------------------------------------------------

process.env.TENANT_URL = "https://test.example.com";
process.env.CLIENT_ID = "test-client";
process.env.CLIENT_SECRET = "test-secret";
process.env.TENANT_NAME = "test-tenant";

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { BACKUP_DIR } from "./backup-path-utils.mjs";
import { assert, finalizeTests } from "./test-utils.mjs";

const { DEFAULT_MAX_EXPORT_ATTEMPTS } = await import("./backup.mjs");

const __dirname = dirname(fileURLToPath(import.meta.url));
const backupSource = readFileSync(join(__dirname, "backup.mjs"), "utf-8");

console.log("Testing flat backup paths...\n");

assert(BACKUP_DIR === "backups", "backup-path-utils BACKUP_DIR is backups");
assert(DEFAULT_MAX_EXPORT_ATTEMPTS === 3, "backup.mjs exports DEFAULT_MAX_EXPORT_ATTEMPTS as 3");
assert(
  backupSource.includes('import { BACKUP_DIR } from "./backup-path-utils.mjs"'),
  "backup.mjs imports BACKUP_DIR from backup-path-utils"
);
assert(
  backupSource.includes("export { BACKUP_DIR }"),
  "backup.mjs re-exports BACKUP_DIR"
);
assert(!backupSource.includes('join("backups", TENANT_NAME)'), "backup.mjs has no nested tenant path");

finalizeTests();
