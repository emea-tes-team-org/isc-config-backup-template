#!/usr/bin/env node
// ---------------------------------------------------------------------------
// ISC Tenant Schedule Toggle
//
// Flips a tenant's `active` flag in tenants.yaml. When re-enabling a tenant
// without a schedule, assigns the default cron "0 0 * * *".
//
// Usage:
//   node scripts/schedule-toggle.mjs <tenant> [--push]
//   PUSH=1 node scripts/schedule-toggle.mjs <tenant>
//
// --push commits and pushes tenants.yaml on main (with pull/rebase retry).
// Does not modify tenant branches, tags, or GitHub Environments.
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_REGISTRY_FILE,
  loadRegistry,
  saveRegistry,
  toggleTenantActive,
} from "./tenant-registry.mjs";

// Re-export for CLI/tests; canonical implementation lives in tenant-registry.mjs.
export { toggleTenantActive };

const MAX_PUSH_RETRIES = 3;

function writeToggleOutput(result) {
  const action = result.newActive ? "enable" : "disable";
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `action=${action}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `new_active=${result.newActive}\n`);
  }
  return action;
}

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf-8",
    stdio: options.stdio ?? ["pipe", "pipe", "pipe"],
    ...options,
  });
}

function pushRegistry(tenantName) {
  runGit(["config", "user.name", "github-actions[bot]"], { stdio: "ignore" });
  runGit(["config", "user.email", "github-actions[bot]@users.noreply.github.com"], {
    stdio: "ignore",
  });

  for (let attempt = 1; attempt <= MAX_PUSH_RETRIES; attempt++) {
    try {
      runGit(["fetch", "origin", "main"], { stdio: "ignore" });
      runGit(["checkout", "main"], { stdio: "ignore" });
      runGit(["pull", "--rebase", "origin", "main"], { stdio: "ignore" });

      const registry = loadRegistry();
      const result = toggleTenantActive(registry, tenantName);
      if (!result.ok) {
        console.error(`Error: ${result.error}`);
        process.exit(1);
      }
      saveRegistry(registry);
      writeToggleOutput(result);

      runGit(["add", DEFAULT_REGISTRY_FILE]);
      const status = runGit(["status", "--porcelain"]).trim();
      if (!status) {
        console.log("No registry changes to commit.");
        return;
      }

      const action = result.newActive ? "enable" : "disable";
      runGit([
        "commit",
        "-m",
        `schedule-toggle: ${action} tenant ${tenantName} in tenants.yaml [skip ci]`,
      ]);
      runGit(["push", "origin", "main"]);
      console.log(`Pushed tenants.yaml to main (${action} ${tenantName}).`);
      return;
    } catch (err) {
      if (attempt === MAX_PUSH_RETRIES) {
        console.error(`Error: failed to push after ${MAX_PUSH_RETRIES} attempts`);
        console.error(err.message || err);
        process.exit(1);
      }
      console.warn(`Push attempt ${attempt} failed, retrying...`);
    }
  }
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const push = args.includes("--push") || process.env.PUSH === "1";
  const tenantName = args.find((a) => !a.startsWith("-"));
  return { tenantName, push };
}

async function main() {
  const { tenantName, push } = parseArgs(process.argv);

  if (!tenantName) {
    console.error("Usage: node scripts/schedule-toggle.mjs <tenant> [--push]");
    process.exit(1);
  }

  if (push) {
    pushRegistry(tenantName);
    return;
  }

  const registry = loadRegistry();
  const result = toggleTenantActive(registry, tenantName);
  if (!result.ok) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  saveRegistry(registry);
  const action = writeToggleOutput(result);
  const state = result.newActive ? "enabled" : "disabled";
  console.log(`Schedule toggle: ${tenantName} is now ${state} (active: ${result.newActive}).`);
  if (!result.newActive) {
    console.log(`${tenantName} was removed from the scheduled backup matrix.`);
  } else {
    console.log(`${tenantName} was added to the scheduled backup matrix.`);
  }
  if (result.newActive && result.tenant.schedule) {
    console.log(`Schedule: ${result.tenant.schedule}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}