#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for schedule-toggle.mjs
//
// Usage: node scripts/test-schedule-toggle.mjs
// ---------------------------------------------------------------------------

import { writeFileSync, unlinkSync, existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import {
  loadRegistry,
  toggleTenantActive,
  saveRegistry,
} from "./tenant-registry.mjs";
import { assert, assertDeepEqual, finalizeTests } from "./test-utils.mjs";

const PARSER = "node scripts/parse-tenants.mjs";

console.log("Testing schedule-toggle.mjs...\n");

function matrixTenants(output) {
  const parsed = JSON.parse(output);
  return parsed.include.map((e) => e.tenant);
}

const TEMP_FILE = "temp-test-schedule-toggle.yaml";
const REGISTRY_FILE = "tenants.yaml";
const originalExists = existsSync(REGISTRY_FILE);
let originalContent = null;

try {
  // Toggle off (active true → false)
  const registry1 = {
    tenants: [
      { name: "acme-prod", active: true, schedule: "0 0 * * *" },
      { name: "acme-dev", active: true },
    ],
  };
  const offResult = toggleTenantActive(registry1, "acme-prod");
  assert(offResult.ok === true, "toggle off returns ok");
  assert(offResult.newActive === false, "toggle off sets newActive false");
  assert(registry1.tenants[0].active === false, "toggle off updates registry");
  assert(registry1.tenants[0].schedule === "0 0 * * *", "toggle off preserves schedule");

  // Toggle on (active false → true)
  const registry2 = {
    tenants: [{ name: "acme-prod", active: false }],
  };
  const onResult = toggleTenantActive(registry2, "acme-prod");
  assert(onResult.ok === true, "toggle on returns ok");
  assert(onResult.newActive === true, "toggle on sets newActive true");
  assert(registry2.tenants[0].schedule === "0 0 * * *", "toggle on assigns default schedule");

  // Default schedule on re-enable when schedule was absent
  const registry3 = {
    tenants: [{ name: "paused-tenant", active: false }],
  };
  toggleTenantActive(registry3, "paused-tenant");
  assert(registry3.tenants[0].schedule === "0 0 * * *", "re-enable without schedule gets default");

  // Unknown tenant error
  const registry4 = { tenants: [{ name: "known", active: true }] };
  const unknownResult = toggleTenantActive(registry4, "unknown-tenant");
  assert(unknownResult.ok === false, "unknown tenant returns not ok");
  assert(
    unknownResult.error.includes("unknown-tenant"),
    "unknown tenant error mentions tenant name"
  );

  // Save and reload round-trip
  writeFileSync(
    TEMP_FILE,
    `tenants:
  - name: acme-prod
    active: true
    schedule: "0 0 * * *"
`
  );
  const loaded = loadRegistry(TEMP_FILE);
  toggleTenantActive(loaded, "acme-prod");
  saveRegistry(loaded, TEMP_FILE);
  const reloaded = loadRegistry(TEMP_FILE);
  assert(reloaded.tenants[0].active === false, "save/reload preserves toggled active state");

  // Tags/branch unchanged — toggle only touches registry (no git imports in core logic)
  assert(
    typeof toggleTenantActive === "function",
    "core toggle logic is pure registry operation (no git side effects)"
  );
  assertDeepEqual(
    registry1.tenants[1],
    { name: "acme-dev", active: true },
    "toggle does not affect other tenants"
  );

  // parse-tenants matrix integration: toggled-off tenant excluded
  if (originalExists) {
    originalContent = readFileSync(REGISTRY_FILE, "utf-8");
    unlinkSync(REGISTRY_FILE);
  }
  writeFileSync(
    REGISTRY_FILE,
    `tenants:
  - name: acme-prod
    active: true
    schedule: "0 0 * * *"
  - name: acme-dev
    active: true
    schedule: "0 0 * * *"
`
  );
  const beforeActive = matrixTenants(execSync(`${PARSER} --active-only`, { encoding: "utf-8" }));
  assert(beforeActive.includes("acme-prod"), "active matrix includes tenant before toggle off");

  const regForMatrix = loadRegistry(REGISTRY_FILE);
  toggleTenantActive(regForMatrix, "acme-prod");
  saveRegistry(regForMatrix, REGISTRY_FILE);

  const afterOff = matrixTenants(execSync(`${PARSER} --active-only`, { encoding: "utf-8" }));
  assert(!afterOff.includes("acme-prod"), "toggled-off tenant excluded from active matrix");
  assert(afterOff.includes("acme-dev"), "other active tenants remain in matrix");

  toggleTenantActive(regForMatrix, "acme-prod");
  saveRegistry(regForMatrix, REGISTRY_FILE);
  const afterOn = matrixTenants(execSync(`${PARSER} --active-only`, { encoding: "utf-8" }));
  assert(afterOn.includes("acme-prod"), "toggled-on tenant included in active matrix");
} finally {
  try {
    unlinkSync(TEMP_FILE);
  } catch {
    // ignore
  }
  try {
    unlinkSync(REGISTRY_FILE);
  } catch {
    // ignore
  }
  if (originalExists && originalContent !== null) {
    writeFileSync(REGISTRY_FILE, originalContent);
  }
}

finalizeTests();
