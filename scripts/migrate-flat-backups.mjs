#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Migrate nested backups/<tenant>/ to flat backups/ on tenant branches.
//
// Usage:
//   node scripts/migrate-flat-backups.mjs [--tenant <name>] [--dry-run]
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, renameSync, rmSync, writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry } from "./tenant-registry.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function git(args, cwd = repoRoot) {
  return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

function gitOrNull(args, cwd = repoRoot) {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

function removeWorktree(workDir) {
  try {
    git(["worktree", "remove", "--force", workDir]);
  } catch {
    // best-effort
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let tenant = null;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tenant" && args[i + 1]) tenant = args[++i];
    else if (args[i] === "--dry-run") dryRun = true;
  }
  return { tenant, dryRun };
}

function flatGitignore(tenantName) {
  return [
    `# Branch-specific gitignore — only track backups for ${tenantName}`,
    "",
    "*",
    "",
    "!.gitignore",
    "!.tenant.yaml",
    "!backups/",
    "!backups/**",
    "!templates/",
    "!templates/**",
    "!vars/",
    "!vars/**",
    "",
    "node_modules/",
    ".env*",
    "*.log",
    ".DS_Store",
    ".github/.local-pat",
    "",
  ].join("\n");
}

function migrateWorkingTree(workDir, tenantName) {
  const nested = join(workDir, "backups", tenantName);
  if (!existsSync(nested)) {
    return false;
  }

  for (const entry of readdirSync(nested, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const src = join(nested, entry.name);
    const dest = join(workDir, "backups", entry.name);
    mkdirSync(dest, { recursive: true });
    for (const file of readdirSync(src)) {
      renameSync(join(src, file), join(dest, file));
    }
    rmSync(src, { recursive: true });
  }
  rmSync(nested, { recursive: true, force: true });
  return true;
}

function migrateTenantBranch(tenantName, dryRun) {
  if (!gitOrNull(["ls-remote", "--heads", "origin", tenantName])) {
    console.log(`  ${tenantName}: branch not found — skipping`);
    return;
  }

  git(["fetch", "origin", tenantName, "--depth=1"]);

  const workDir = mkdtempSync(join(tmpdir(), `migrate-flat-${tenantName}-`));
  const workBranch = `migrate-flat-${tenantName}`;

  try {
    git(["worktree", "add", "-B", workBranch, workDir, `origin/${tenantName}`]);

    const nested = join(workDir, "backups", tenantName);
    if (!existsSync(nested)) {
      console.log(`  ${tenantName}: already flat (no backups/${tenantName}/)`);
      return;
    }

    if (dryRun) {
      console.log(`  ${tenantName}: [dry-run] would move backups/${tenantName}/* → backups/`);
      return;
    }

    migrateWorkingTree(workDir, tenantName);
    writeFileSync(join(workDir, ".gitignore"), flatGitignore(tenantName));
    git(["add", "-A"], workDir);
    git(["commit", "-m", `migrate: flat backups/ layout for ${tenantName}`], workDir);
    git(["push", "origin", `${workBranch}:${tenantName}`], workDir);
    console.log(`  ${tenantName}: migration pushed`);
  } finally {
    removeWorktree(workDir);
    git(["branch", "-D", workBranch]);
  }
}

const { tenant, dryRun } = parseArgs();
const registry = loadRegistry();
const tenants = tenant
  ? registry.tenants.filter((t) => t.name === tenant)
  : registry.tenants;

if (tenants.length === 0) {
  console.error("No matching tenants in registry");
  process.exit(1);
}

git(["config", "user.name", "github-actions[bot]"]);
git(["config", "user.email", "github-actions[bot]@users.noreply.github.com"]);

console.log(`Migrating ${tenants.length} tenant branch(es)${dryRun ? " (dry-run)" : ""}...`);

let failed = 0;
for (const { name } of tenants) {
  console.log(`\n${name}:`);
  try {
    migrateTenantBranch(name, dryRun);
  } catch (err) {
    console.error(`  ${name}: FAILED — ${err.message}`);
    failed++;
  }
}

console.log("\nDone.");
if (failed > 0) process.exit(1);
