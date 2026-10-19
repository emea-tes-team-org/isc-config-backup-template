#!/usr/bin/env node
// ---------------------------------------------------------------------------
// ISC Tenant Offboard
//
// Decommissions a tenant: removes registry entry, deletes older backup tags
// (keeps the latest restore-point tag), squashes the tenant branch to a single
// snapshot commit, and sets active: false in .tenant.yaml. Preserves the branch
// and GitHub Environment.
//
// Usage:
//   node scripts/offboard.mjs <tenant> [--yes]
//   CONFIRM=<tenant> node scripts/offboard.mjs <tenant>
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_REGISTRY_FILE,
  loadRegistry,
  saveRegistry,
  removeTenantFromRegistry,
} from "./tenant-registry.mjs";
import { parseTagTimestamp } from "./parse-tenants.mjs";
import { deleteReleaseForTag } from "./prune-tags.mjs";

/**
 * Filter remote tag names to those belonging to a tenant (<tenant>/*).
 */
export function listTenantTags(tags, tenant) {
  const prefix = `${tenant}/`;
  return tags.filter((tag) => tag.startsWith(prefix));
}

/**
 * Update active: false in .tenant.yaml content.
 */
export function setTenantYamlInactive(content) {
  if (/^active:\s*.+$/m.test(content)) {
    return content.replace(/^active:\s*.+$/m, "active: false");
  }
  return `${content.trimEnd()}\nactive: false\n`;
}

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf-8",
    stdio: options.stdio ?? ["pipe", "pipe", "pipe"],
    ...options,
  });
}

function listRemoteTags() {
  const output = runGit(["ls-remote", "--tags", "origin"]);
  const tags = [];
  for (const line of output.split("\n")) {
    const match = line.match(/refs\/tags\/(.+?)(?:\^\{\})?$/);
    if (match) {
      tags.push(match[1]);
    }
  }
  return [...new Set(tags)];
}

function deleteRemoteTag(tag) {
  runGit(["push", "origin", `:refs/tags/${tag}`], { stdio: "ignore" });
}

/**
 * Select the backup tag with the greatest name-embedded UTC timestamp for a tenant.
 * Returns null when no valid backup tags exist.
 */
export function selectLatestTenantTag(tags, tenant) {
  const tenantTags = listTenantTags(tags, tenant);
  let latest = null;
  let latestTs = null;

  for (const tag of tenantTags) {
    const ts = parseTagTimestamp(tag);
    if (ts === null) {
      continue;
    }
    if (latestTs === null || ts > latestTs || (ts === latestTs && tag > latest)) {
      latest = tag;
      latestTs = ts;
    }
  }

  return latest;
}

/**
 * Tags to delete on offboard: all tenant tags except the latest valid backup tag.
 */
export function tagsToDeleteOnOffboard(tags, tenant) {
  const tenantTags = listTenantTags(tags, tenant);
  if (tenantTags.length === 0) {
    return [];
  }
  const latest = selectLatestTenantTag(tags, tenant);
  return tenantTags.filter((tag) => tag !== latest);
}

/**
 * Delete stale tenant tags on offboard, keeping the latest restore-point tag.
 * Also deletes GitHub Releases for pruned tags when releaseDeleteFn is provided.
 */
export function pruneTenantTagsOnOffboard(
  tenantName,
  allTags,
  deleteTag = deleteRemoteTag,
  releaseDeleteFn = deleteReleaseForTag
) {
  const tenantTags = listTenantTags(allTags, tenantName);
  if (tenantTags.length === 0) {
    return { kept: null, deleted: [] };
  }

  const kept = selectLatestTenantTag(allTags, tenantName);
  const deleted = tagsToDeleteOnOffboard(allTags, tenantName);

  for (const tag of deleted) {
    deleteTag(tag);
    if (releaseDeleteFn) {
      releaseDeleteFn(tag);
    }
  }

  return { kept, deleted };
}

export function squashTenantBranch(tenantName, gitRunner = runGit) {
  gitRunner(["checkout", tenantName], { stdio: "ignore" });

  const tenantYamlPath = ".tenant.yaml";
  if (existsSync(tenantYamlPath)) {
    const updated = setTenantYamlInactive(readFileSync(tenantYamlPath, "utf-8"));
    writeFileSync(tenantYamlPath, updated);
  }

  const tempBranch = `offboard-squash-${Date.now()}`;
  gitRunner(["checkout", "--orphan", tempBranch], { stdio: "ignore" });
  gitRunner(["add", "-A"], { stdio: "ignore" });
  gitRunner(
    ["commit", "-m", `chore: offboard tenant ${tenantName} — squash to snapshot [skip ci]`],
    { stdio: "ignore" }
  );
  gitRunner(["branch", "-M", tenantName], { stdio: "ignore" });
  gitRunner(["push", "--force", "origin", tenantName], { stdio: "ignore" });
}

function askConfirmation(tenantName) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(
      `Type "${tenantName}" to confirm offboard: `,
      (answer) => {
        rl.close();
        resolve(answer.trim() === tenantName);
      }
    );
  });
}

export function checkConfirmation(tenantName, { yes = false, confirmEnv = process.env.CONFIRM } = {}) {
  if (yes) return Promise.resolve(true);
  if (confirmEnv === tenantName) return Promise.resolve(true);
  if (confirmEnv && confirmEnv !== tenantName) return Promise.resolve(false);
  return askConfirmation(tenantName);
}

export function offboardRegistry(tenantName, registryFile = DEFAULT_REGISTRY_FILE) {
  const registry = loadRegistry(registryFile);
  const result = removeTenantFromRegistry(registry, tenantName);
  if (!result.ok) {
    return result;
  }
  saveRegistry(registry, registryFile);
  return { ok: true };
}

export async function offboardTenant(tenantName, options = {}) {
  const {
    skipConfirmation = false,
    yes = false,
    skipGit = false,
    push = process.env.PUSH === "1",
    registryFile = DEFAULT_REGISTRY_FILE,
    gitRunner = runGit,
  } = options;

  const registry = loadRegistry(registryFile);
  if (!registry.tenants.some((t) => t.name === tenantName)) {
    return { ok: false, error: `Tenant "${tenantName}" not found` };
  }

  if (!skipConfirmation) {
    const confirmed = await checkConfirmation(tenantName, { yes });
    if (!confirmed) {
      return { ok: false, error: "Confirmation failed — offboard cancelled" };
    }
  }

  if (!skipGit) {
    runGit(["config", "user.name", "github-actions[bot]"], { stdio: "ignore" });
    runGit(["config", "user.email", "github-actions[bot]@users.noreply.github.com"], {
      stdio: "ignore",
    });

    runGit(["checkout", "main"], { stdio: "ignore" });
  }

  const registryResult = offboardRegistry(tenantName, registryFile);
  if (!registryResult.ok) {
    return registryResult;
  }

  if (!skipGit) {
    runGit(["add", DEFAULT_REGISTRY_FILE]);
    const status = runGit(["status", "--porcelain"]).trim();
    if (status) {
      runGit([
        "commit",
        "-m",
        `offboard: remove tenant ${tenantName} from tenants.yaml [skip ci]`,
      ]);
      if (push || process.env.CI === "true") {
        runGit(["push", "origin", "main"], { stdio: "ignore" });
      }
    }

    const allTags = listRemoteTags();
    const { kept, deleted } = pruneTenantTagsOnOffboard(tenantName, allTags, (tag) => {
      console.log(`Deleting tag: ${tag}`);
      deleteRemoteTag(tag);
    });
    if (kept) {
      console.log(`Kept latest tag: ${kept}`);
    }
    if (deleted.length > 0) {
      console.log(`Deleted ${deleted.length} older tag(s) for ${tenantName}.`);
    }

    console.log(`Squashing branch ${tenantName}...`);
    squashTenantBranch(tenantName, gitRunner);
  }

  console.log(`Offboard complete for ${tenantName}.`);
  return { ok: true };
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  const yes = args.includes("--yes");
  const tenantName = args.find((a) => !a.startsWith("-"));
  return { tenantName, yes };
}

async function main() {
  const { tenantName, yes } = parseArgs(process.argv);

  if (!tenantName) {
    console.error("Usage: node scripts/offboard.mjs <tenant> [--yes]");
    process.exit(1);
  }

  const result = await offboardTenant(tenantName, { yes });
  if (!result.ok) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
