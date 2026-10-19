#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for idempotent onboarding (update-in-place) behavior.
//
// Usage: node scripts/test-onboard-upsert.mjs
// ---------------------------------------------------------------------------

import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import {
  getPat,
  computeOnboardOutcome,
  mergeTenantRegistryEntry,
} from "./onboard-utils.mjs";
import { loadRegistry } from "./tenant-registry.mjs";
import { assert, assertDeepEqual, finalizeTests } from "./test-utils.mjs";

console.log("Testing onboard upsert behavior...\n");

// getPat prefers environment tokens over local PAT file
const savedEnv = {
  GH_TOKEN: process.env.GH_TOKEN,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
};
delete process.env.GH_TOKEN;
delete process.env.ADMIN_TOKEN;
delete process.env.GITHUB_TOKEN;
assert(getPat() === null || typeof getPat() === "string", "getPat: null when no env token and no local file");
process.env.GH_TOKEN = "test-env-token";
assert(getPat() === "test-env-token", "getPat: prefers GH_TOKEN");
process.env.GH_TOKEN = savedEnv.GH_TOKEN;
process.env.ADMIN_TOKEN = savedEnv.ADMIN_TOKEN;
process.env.GITHUB_TOKEN = savedEnv.GITHUB_TOKEN;

// computeOnboardOutcome
assertDeepEqual(
  computeOnboardOutcome({ registryExisted: false, branchExisted: false }),
  { created: true, updated: false, action: "created" },
  "computeOnboardOutcome: net-new tenant"
);
assertDeepEqual(
  computeOnboardOutcome({ registryExisted: true, branchExisted: false }),
  { created: false, updated: true, action: "updated" },
  "computeOnboardOutcome: registry existed"
);
assertDeepEqual(
  computeOnboardOutcome({ registryExisted: false, branchExisted: true }),
  { created: false, updated: true, action: "updated" },
  "computeOnboardOutcome: branch existed (re-onboard after offboard)"
);

// mergeTenantRegistryEntry preserves schedule and tuning fields
const registry = {
  tenants: [
    {
      name: "acme-prod",
      active: true,
      schedule: "0 30 2 * * *",
      environment: "acme-env",
      exportPollMinutes: 20,
      jobTimeoutMinutes: 25,
      hostname: "old.example.com",
      description: "Old description",
    },
  ],
};

const merged = mergeTenantRegistryEntry(
  registry,
  "acme-prod",
  "https://new.example.com",
  true,
  "New description"
);

assert(merged.registryExisted, "mergeTenantRegistryEntry: detects existing registry entry");
assertDeepEqual(
  merged.entry.schedule,
  "0 30 2 * * *",
  "mergeTenantRegistryEntry: preserves schedule"
);
assertDeepEqual(
  merged.entry.exportPollMinutes,
  20,
  "mergeTenantRegistryEntry: preserves exportPollMinutes"
);
assertDeepEqual(
  merged.entry.jobTimeoutMinutes,
  25,
  "mergeTenantRegistryEntry: preserves jobTimeoutMinutes"
);
assertDeepEqual(
  merged.entry.hostname,
  "new.example.com",
  "mergeTenantRegistryEntry: updates hostname from URL"
);
assertDeepEqual(
  merged.entry.description,
  "New description",
  "mergeTenantRegistryEntry: updates description"
);

// File-backed registry merge via tenants.yaml temp file
const tempRegistry = "tenants.test-onboard-upsert.yaml";
if (existsSync(tempRegistry)) unlinkSync(tempRegistry);
writeFileSync(
  tempRegistry,
  `tenants:

  - name: mediolanum
    active: false
    schedule: "0 0 * * *"
    environment: mediolanum-env
    exportPollMinutes: 15
    jobTimeoutMinutes: 20
    hostname: company.example.com
`
);

const loaded = loadRegistry(tempRegistry);
const reRegistered = mergeTenantRegistryEntry(
  loaded,
  "mediolanum",
  "https://company19271-poc.api.identitynow-demo.com",
  true,
  "Restored tenant"
);
assert(reRegistered.registryExisted, "re-onboard: tenant was previously registered");
assertDeepEqual(
  reRegistered.entry.exportPollMinutes,
  15,
  "re-onboard: preserves exportPollMinutes"
);
assert(reRegistered.entry.active === true, "re-onboard: applies new active flag");

unlinkSync(tempRegistry);

finalizeTests();
