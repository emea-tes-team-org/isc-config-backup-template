#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Unified CLI router for local development and GitHub Actions.
//
// Loads .env when present (local dev) and delegates to the existing scripts
// in scripts/*.mjs. In CI, .env is absent and credentials come from secrets.
//
// Usage:
//   node scripts/cli.mjs <command> [args]
//   npm run cli -- <command> [args]
//
// Commands:
//   backup           -> scripts/backup.mjs
//   restore          -> scripts/restore.mjs
//   tokenize         -> scripts/tokenize.mjs
//   onboard          -> scripts/onboard.mjs
//   schedule-toggle  -> scripts/schedule-toggle.mjs
//   offboard         -> scripts/offboard.mjs
//   tenants          -> scripts/parse-tenants.mjs
//   verify           -> scripts/verify-onboarding.mjs
// ---------------------------------------------------------------------------

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Local .env loading (no-op in CI where .env is absent)
// ---------------------------------------------------------------------------
function loadEnvFile(path = join(__dirname, "..", ".env")) {
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Remove surrounding quotes, if any
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Only set if not already present so real env vars take precedence
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// ---------------------------------------------------------------------------
// Command routing table
// ---------------------------------------------------------------------------
const COMMANDS = {
  backup: "backup.mjs",
  restore: "restore.mjs",
  tokenize: "tokenize.mjs",
  onboard: "onboard.mjs",
  "schedule-toggle": "schedule-toggle.mjs",
  offboard: "offboard.mjs",
  tenants: "parse-tenants.mjs",
  verify: "verify-onboarding.mjs",
};

function printHelp() {
  console.log(`Usage: node scripts/cli.mjs <command> [args]

Commands:
  backup                  Run a backup for the current tenant
  restore <source>        Restore configuration from a source ref/tenant
  tokenize <subcommand>   Run tokenization tools
  onboard [args]          Onboard or manage tenants
  schedule-toggle <tenant>  Flip active flag in tenants.yaml (pause/resume backups)
  offboard <tenant>       Decommission tenant (registry, tags, branch squash)
  tenants [args]          Query the tenant registry
  verify <tenant>         Verify onboarding for a tenant

Examples:
  node scripts/cli.mjs backup
  npm run cli -- backup
  npm run cli -- restore local --tenant tenant-b --target tenant-c
  npm run cli -- tokenize create-template beta-15156 --template default
  npm run cli -- schedule-toggle acme-prod
  npm run cli -- offboard acme-prod --yes
  npm run cli -- tenants --active-only
  npm run cli -- verify acme-prod
`);
}

async function main() {
  loadEnvFile();

  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const command = args[0];
  const script = COMMANDS[command];

  if (!script) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  const scriptPath = join(__dirname, script);
  if (!existsSync(scriptPath)) {
    console.error(`Script not found: ${scriptPath}`);
    process.exit(1);
  }

  const child = spawn(process.execPath, [scriptPath, ...args.slice(1)], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });
}

main();

