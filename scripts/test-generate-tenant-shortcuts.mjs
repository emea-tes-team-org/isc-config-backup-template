#!/usr/bin/env node
// Usage: node scripts/test-generate-tenant-shortcuts.mjs

import { readFileSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  generateTenantShortcutWorkflows,
  tenantShortcutWorkflowFile,
  validateOffboardConfirm,
  workflowDispatchUrl,
  OFFBOARD_CONFIRM_SHELL,
} from "./generate-tenant-shortcuts.mjs";
import { assert, finalizeTests } from "./test-utils.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const testDir = join(root, ".github/workflows/tenant-shortcuts-test");

console.log("Testing generate-tenant-shortcuts...\n");

assert(OFFBOARD_CONFIRM_SHELL.includes('if [ "$CONFIRM" != "offboard" ]; then'), "OFFBOARD_CONFIRM_SHELL checks CONFIRM env var");
assert(OFFBOARD_CONFIRM_SHELL.includes('exit 1'), "OFFBOARD_CONFIRM_SHELL exits with 1 on mismatch");


const registry = { tenants: [{ name: "fernando" }, { name: "andre" }] };
const { files } = await generateTenantShortcutWorkflows(registry, { workflowsDir: testDir });

assert(files.includes("isc-backup-fernando.yml"), "generates backup shortcut");
assert(files.includes("isc-toggle-andre.yml"), "generates toggle shortcut");
assert(files.includes("isc-verify-fernando.yml"), "generates verify shortcut");
assert(files.includes("isc-offboard-andre.yml"), "generates offboard shortcut");

const backup = readFileSync(join(testDir, "isc-backup-fernando.yml"), "utf-8");
assert(backup.includes('workflow_id: "isc-backup.yml"'), "backup shortcut targets isc-backup.yml");
assert(backup.includes('"tenant":"fernando"') || backup.includes('"tenant": "fernando"'), "backup shortcut sets tenant");

const verify = readFileSync(join(testDir, "isc-verify-fernando.yml"), "utf-8");
assert(verify.includes('workflow_id: "isc-lifecycle.yml"'), "verify shortcut targets isc-lifecycle.yml");
assert(
  verify.includes('"operation":"verify"') || verify.includes('"operation": "verify"'),
  "verify shortcut sets operation verify"
);

const offboard = readFileSync(join(testDir, "isc-offboard-fernando.yml"), "utf-8");
assert(offboard.includes('workflow_id: "isc-lifecycle.yml"'), "offboard shortcut targets isc-lifecycle.yml");
assert(offboard.includes('CONFIRM" != "offboard"'), "offboard shortcut validates confirm keyword");
assert(
  offboard.includes('"confirm_tenant":"fernando"') || offboard.includes('"confirm_tenant": "fernando"'),
  "offboard shortcut auto-sets confirm_tenant"
);
assert(validateOffboardConfirm("offboard"), "offboard confirm accepts keyword at runtime");
assert(!validateOffboardConfirm("fernando"), "offboard confirm rejects wrong value at runtime");
assert(!validateOffboardConfirm(""), "offboard confirm rejects empty value at runtime");

const url = workflowDispatchUrl("org/repo", tenantShortcutWorkflowFile("fernando", "backup"));
assert(
  url === "https://github.com/org/repo/actions/workflows/isc-backup-fernando.yml",
  "shortcut URL uses flat workflow filename"
);
assert(!url.includes("query="), "dispatch URL has no query param");

if (existsSync(testDir)) rmSync(testDir, { recursive: true });

finalizeTests();
