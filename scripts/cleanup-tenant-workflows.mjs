#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Remove .github/workflows/ from tenant branches (one-time data-only cleanup).
//
// Usage:
//   node scripts/cleanup-tenant-workflows.mjs [--tenant NAME] [--dry-run]
//
// Environment:
//   GITHUB_REPOSITORY — owner/repo (required outside Actions)
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry } from "./tenant-registry.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function runGit(args, cwd = repoRoot, options = {}) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: options.stdio ?? ["pipe", "pipe", "pipe"],
    ...options,
  }).trim();
}

function runGitOrNull(args, cwd = repoRoot) {
  try {
    return runGit(args, cwd);
  } catch {
    return null;
  }
}

function removeWorktree(workDir) {
  try {
    runGit(["worktree", "remove", "--force", workDir]);
  } catch {
    // best-effort cleanup
  }
}

/**
 * @param {string[]} tenants
 * @param {{ dryRun?: boolean, pushAttempts?: number, repoRoot?: string }} options
 * @param {{ runGit: typeof runGit, runGitOrNull: typeof runGitOrNull, existsSync: typeof existsSync, mkWorkDir: () => string, log: (...args: unknown[]) => void }} deps
 * @returns {{ cleaned: string[], skipped: string[], failed: string[] }}
 */
export function cleanupTenantWorkflows(tenants, options = {}, deps = {}) {
  const root = options.repoRoot ?? repoRoot;
  const runGitFn = (args, cwd) => (deps.runGit ?? runGit)(args, cwd ?? root);
  const runGitOrNullFn = (args, cwd) => (deps.runGitOrNull ?? runGitOrNull)(args, cwd ?? root);
  const existsFn = deps.existsSync ?? existsSync;
  const mkWorkDir = deps.mkWorkDir ?? (() => mkdtempSync(join(tmpdir(), "cleanup-wf-")));
  const log = deps.log ?? console.log;

  const dryRun = options.dryRun ?? false;
  const pushAttempts = options.pushAttempts ?? 3;
  const cleaned = [];
  const skipped = [];
  const failed = [];

  for (const tenant of tenants) {
    log(`\n--- ${tenant} ---`);

    if (!runGitOrNullFn(["ls-remote", "--heads", "origin", tenant])) {
      log(`Branch origin/${tenant} not found — skipping`);
      skipped.push(tenant);
      continue;
    }

    runGitFn(["fetch", "origin", tenant, "--depth=1"]);

    const workDir = mkWorkDir();
    const workBranch = `cleanup-wf-${tenant}`;
    const workflowsPath = join(workDir, ".github", "workflows");

    try {
      runGitFn(["worktree", "add", "-B", workBranch, workDir, `origin/${tenant}`]);

      if (!existsFn(workflowsPath)) {
        log(`No .github/workflows/ on ${tenant} — already clean`);
        skipped.push(tenant);
        continue;
      }

      if (dryRun) {
        log(`[dry-run] Would remove .github/workflows/ and push to ${tenant}`);
        cleaned.push(tenant);
        continue;
      }

      runGitFn(["rm", "-rf", ".github/workflows"], workDir);
      runGitFn(
        ["commit", "-m", "chore: remove workflow copies from tenant branch [skip ci]"],
        workDir
      );

      let pushed = false;
      for (let attempt = 1; attempt <= pushAttempts; attempt++) {
        try {
          runGitFn(["push", "origin", `${workBranch}:${tenant}`], workDir);
          pushed = true;
          break;
        } catch (err) {
          log(`Push attempt ${attempt}/${pushAttempts} failed: ${err.message}`);
          if (attempt < pushAttempts) {
            execFileSync("sleep", [String(attempt * 15)]);
          }
        }
      }

      if (pushed) {
        log(`Removed .github/workflows/ from ${tenant}`);
        cleaned.push(tenant);
      } else {
        log(`Failed to push cleanup for ${tenant}`);
        failed.push(tenant);
      }
    } finally {
      if (!deps.mkWorkDir) {
        removeWorktree(workDir);
      }
      runGitFn(["branch", "-D", workBranch]);
    }
  }

  return { cleaned, skipped, failed };
}

function parseArgs(argv) {
  const tenants = [];
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--tenant") {
      tenants.push(argv[++i]);
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/cleanup-tenant-workflows.mjs [--tenant NAME] [--dry-run]`);
      process.exit(0);
    }
  }

  return { tenants, dryRun };
}

function main() {
  const { tenants: tenantFilter, dryRun } = parseArgs(process.argv.slice(2));
  const registry = loadRegistry();
  const tenants =
    tenantFilter.length > 0
      ? tenantFilter
      : registry.tenants.map((t) => t.name);

  if (tenants.length === 0) {
    console.log("No tenants to process.");
    return;
  }

  console.log(`Tenants: ${tenants.join(", ")}`);
  if (dryRun) console.log("Dry run — no commits or pushes");

  runGit(["config", "user.name", "github-actions[bot]"]);
  runGit(["config", "user.email", "github-actions[bot]@users.noreply.github.com"]);

  const { cleaned, skipped, failed } = cleanupTenantWorkflows(tenants, { dryRun });

  console.log("\nSummary:");
  console.log(`  cleaned: ${cleaned.length ? cleaned.join(", ") : "(none)"}`);
  console.log(`  skipped: ${skipped.length ? skipped.join(", ") : "(none)"}`);
  console.log(`  failed:  ${failed.length ? failed.join(", ") : "(none)"}`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
