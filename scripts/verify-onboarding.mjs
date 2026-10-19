#!/usr/bin/env node
// ---------------------------------------------------------------------------
// E2E onboarding verification script
// ---------------------------------------------------------------------------
// Validates that a tenant was fully onboarded by the GitHub Actions onboarding
// workflow. Runs read-only checks against:
//   - the tenant branch on origin
//   - the GitHub Environment and its secrets
//   - .tenant.yaml and .gitignore on the tenant branch
//   - tenants.yaml on main
// Optionally dispatches scheduled-backup.yml and verifies backup artifacts.
//
// Usage:
//   node scripts/verify-onboarding.mjs <tenant-name> [--backup]
// Prerequisites:
//   - gh CLI authenticated with a token that has `repo` scope
//   - git remote `origin` pointing to the GitHub repository
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";
import yaml from "js-yaml";
import { getTenant } from "./tenant-registry.mjs";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: node scripts/verify-onboarding.mjs <tenant-name> [--backup]

Verify that an ISC tenant was fully onboarded.

Options:
  --backup    Dispatch scheduled-backup.yml for the tenant and verify artifacts
  --help      Show this help message

Examples:
  node scripts/verify-onboarding.mjs company12926-poc
  node scripts/verify-onboarding.mjs company12926-poc --backup
`);
  process.exit(0);
}

const tenantName = args.find((arg) => !arg.startsWith("-"));
const backupFlag = args.includes("--backup");

if (!tenantName) {
  console.error("ERROR: Missing required argument <tenant-name>");
  console.error("Usage: node scripts/verify-onboarding.mjs <tenant-name> [--backup]");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// gh CLI authentication prerequisite
// ---------------------------------------------------------------------------
try {
  execFileSync("gh", ["auth", "status"], { stdio: "pipe" });
} catch {
  console.error("ERROR: gh CLI is not authenticated or the auth command failed.");
  console.error("Run: gh auth login");
  console.error("The token needs Actions: Read-only and Environments: Read-only to read environments and their secrets.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------
const results = [];

function addResult(check, status, detail = "") {
  results.push({ check, status, detail });
}

function printSummary() {
  console.log("\n" + "=".repeat(70));
  console.log("Verification Summary");
  console.log("=".repeat(70));
  for (const { check, status, detail } of results) {
    const mark = status === "PASSED" ? "✓" : status === "WARNING" ? "⚠" : "✗";
    console.log(`${mark} ${check}: ${status}`);
    if (detail) {
      for (const line of detail.split("\n")) {
        console.log(`    ${line}`);
      }
    }
  }
  const failed = results.filter((r) => r.status === "FAILED").length;
  console.log("-".repeat(70));
  console.log(`${results.length - failed}/${results.length} checks passed`);
  console.log("=".repeat(70));
  return failed === 0;
}

// ---------------------------------------------------------------------------
// Helper: run a command and return stdout, or undefined on failure
// ---------------------------------------------------------------------------
function run(cmd, args, options = {}) {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      ...options,
    }).trim();
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Helper: read a file from a git ref
// ---------------------------------------------------------------------------
function readGitFile(ref, path) {
  return run("git", ["show", `${ref}:${path}`]);
}

// ---------------------------------------------------------------------------
// Helper: resolve GitHub owner/repo from git remote `origin`
// ---------------------------------------------------------------------------
function getRepoSlug() {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    // Supports https://github.com/owner/repo.git and git@github.com:owner/repo.git
    const match = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
  } catch {
    // fall through
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// 1. Branch existence
// ---------------------------------------------------------------------------
const branchCheck = run("git", ["ls-remote", "--heads", "origin", tenantName]);
const branchExists =
  branchCheck !== undefined && branchCheck.includes(`refs/heads/${tenantName}`);

if (branchExists) {
  addResult("Tenant branch exists", "PASSED", `refs/heads/${tenantName}`);
} else {
  addResult(
    "Tenant branch exists",
    "FAILED",
    `No ref refs/heads/${tenantName} found on origin`
  );
}

// ---------------------------------------------------------------------------
// 2. GitHub Environment existence
// ---------------------------------------------------------------------------
const repoSlug = getRepoSlug();
let environmentExists = false;

if (!repoSlug) {
  addResult(
    "GitHub Environment exists",
    "FAILED",
    "Could not determine repository owner/name from gh CLI"
  );
} else {
  const envApiOutput = run("gh", [
    "api",
    `repos/${repoSlug}/environments/${tenantName}`,
  ]);

  if (envApiOutput === undefined) {
    addResult(
      "GitHub Environment exists",
      "FAILED",
      `Environment "${tenantName}" not found in ${repoSlug}`
    );
  } else {
    try {
      const parsed = JSON.parse(envApiOutput);
      // 403/429 are returned by gh with non-zero exit, so run() already returned undefined.
      // We still guard against rate-limit messages in the body for robustness.
      if (parsed.message && parsed.message.toLowerCase().includes("rate limit")) {
        addResult(
          "GitHub Environment exists",
          "WARNING",
          "GitHub API rate limit encountered. Retry after the rate limit window resets."
        );
      } else {
        environmentExists = true;
        addResult(
          "GitHub Environment exists",
          "PASSED",
          `Environment "${tenantName}" found in ${repoSlug}`
        );
      }
    } catch {
      environmentExists = true;
      addResult(
        "GitHub Environment exists",
        "PASSED",
        `Environment "${tenantName}" found in ${repoSlug}`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Environment secrets
// ---------------------------------------------------------------------------
if (!environmentExists) {
  addResult(
    "Environment secrets present",
    "SKIPPED",
    "Environment does not exist; skipping secret check"
  );
} else {
  const secretList = run("gh", ["secret", "list", "--env", tenantName, "-R", repoSlug]);

  if (secretList === undefined) {
    addResult(
      "Environment secrets present",
      "FAILED",
      "Could not list secrets for environment (gh CLI failed)"
    );
  } else {
    const requiredSecrets = ["TENANT_URL", "CLIENT_ID", "CLIENT_SECRET"];
    const presentSecrets = secretList
      .split("\n")
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean);
    const missing = requiredSecrets.filter((s) => !presentSecrets.includes(s));

    if (missing.length === 0) {
      addResult(
        "Environment secrets present",
        "PASSED",
        "TENANT_URL, CLIENT_ID, CLIENT_SECRET found"
      );
    } else {
      addResult(
        "Environment secrets present",
        "FAILED",
        `Missing secrets: ${missing.join(", ")}`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 4. .tenant.yaml on tenant branch
// ---------------------------------------------------------------------------
let descriptor = null;

if (!branchExists) {
  addResult(
    ".tenant.yaml valid",
    "SKIPPED",
    "Tenant branch does not exist; skipping descriptor check"
  );
} else {
  const raw = readGitFile(tenantName, ".tenant.yaml");

  if (raw === undefined) {
    addResult(
      ".tenant.yaml valid",
      "FAILED",
      ".tenant.yaml not found on tenant branch"
    );
  } else {
    try {
      descriptor = yaml.load(raw);
    } catch (err) {
      addResult(".tenant.yaml valid", "FAILED", `YAML parse error: ${err.message}`);
    }

    if (descriptor) {
      const errors = [];
      if (descriptor.name !== tenantName) {
        errors.push(`name must be "${tenantName}" but got "${descriptor.name}"`);
      }
      if (typeof descriptor.url !== "string" || descriptor.url.trim() === "") {
        errors.push("url must be a non-empty string");
      }
      if (typeof descriptor.active !== "boolean") {
        errors.push("active must be a boolean");
      }
      if (typeof descriptor.description !== "string") {
        errors.push("description must be a string");
      }

      if (errors.length === 0) {
        addResult(
          ".tenant.yaml valid",
          "PASSED",
          `name=${descriptor.name}, active=${descriptor.active}`
        );
      } else {
        addResult(".tenant.yaml valid", "FAILED", errors.join("\n"));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. .gitignore on tenant branch
// ---------------------------------------------------------------------------
if (!branchExists) {
  addResult(
    ".gitignore valid",
    "SKIPPED",
    "Tenant branch does not exist; skipping .gitignore check"
  );
} else {
  const raw = readGitFile(tenantName, ".gitignore");

  if (raw === undefined) {
    addResult(".gitignore valid", "FAILED", ".gitignore not found on tenant branch");
  } else {
    const lines = raw.split("\n").map((l) => l.trim());
    const allowsFlatBackups =
      lines.some((l) => l === "!backups/") ||
      lines.some((l) => l === "!backups/**");

    if (allowsFlatBackups) {
      addResult(
        ".gitignore valid",
        "PASSED",
        "flat backups/ tracked"
      );
    } else {
      addResult(
        ".gitignore valid",
        "FAILED",
        'missing "!backups/" or "!backups/**" exception line for flat layout'
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 6. tenants.yaml registry on main
// ---------------------------------------------------------------------------
const registryRaw = readGitFile("origin/main", "tenants.yaml");

if (registryRaw === undefined) {
  addResult(
    "Tenant in tenants.yaml",
    "FAILED",
    "Could not read tenants.yaml from origin/main"
  );
} else {
  try {
    const registry = yaml.load(registryRaw);
    const entry = getTenant(registry, tenantName);

    if (!entry) {
      addResult(
        "Tenant in tenants.yaml",
        "FAILED",
        `Tenant "${tenantName}" not found in tenants.yaml`
      );
    } else {
      const expectedActive = descriptor?.active;
      if (expectedActive !== undefined && entry.active !== expectedActive) {
        addResult(
          "Tenant in tenants.yaml",
          "FAILED",
          `tenants.yaml active=${entry.active} does not match .tenant.yaml active=${expectedActive}`
        );
      } else {
        addResult(
          "Tenant in tenants.yaml",
          "PASSED",
          `active=${entry.active}`
        );
      }
    }
  } catch (err) {
    addResult(
      "Tenant in tenants.yaml",
      "FAILED",
      `YAML parse error: ${err.message}`
    );
  }
}

// ---------------------------------------------------------------------------
// 7. Optional backup verification
// ---------------------------------------------------------------------------
if (!backupFlag) {
  addResult(
    "Backup artifacts committed",
    "SKIPPED",
    "Use --backup to dispatch a backup and verify committed artifacts"
  );
} else {
  const dispatchOutput = run("gh", [
    "workflow",
    "run",
    "scheduled-backup.yml",
    "--ref",
    "main",
    "-f",
    `tenant=${tenantName}`,
    "-R",
    repoSlug,
  ]);

  if (dispatchOutput === undefined) {
    addResult(
      "Backup artifacts committed",
      "FAILED",
      "Failed to dispatch scheduled-backup.yml"
    );
  } else {
    console.log(`\nDispatched scheduled-backup.yml for tenant "${tenantName}". Waiting for completion...`);

    let runId = null;
    let attempts = 0;
    const maxWaitAttempts = 60; // ~5 minutes with 5s sleep

    // Wait briefly for the run to appear in the list
    for (let i = 0; i < 12 && !runId; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const listOutput = run("gh", [
        "run",
        "list",
        "--workflow=scheduled-backup.yml",
        "--limit=1",
        "--json=databaseId,status,conclusion,createdAt",
        "-R",
        repoSlug,
      ]);

      if (listOutput) {
        try {
          const runs = JSON.parse(listOutput);
          if (runs.length > 0) {
            runId = runs[0].databaseId;
          }
        } catch {
          // ignore parse errors and retry
        }
      }
    }

    if (!runId) {
      addResult(
        "Backup artifacts committed",
        "FAILED",
        "Could not find dispatched workflow run in GitHub Actions list"
      );
    } else {
      let completed = false;
      let conclusion = null;

      while (attempts < maxWaitAttempts && !completed) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;

        const viewOutput = run("gh", ["run", "view", runId, "--json=status,conclusion", "-R", repoSlug]);
        if (viewOutput) {
          try {
            const info = JSON.parse(viewOutput);
            if (info.status === "completed") {
              completed = true;
              conclusion = info.conclusion;
            } else {
              process.stdout.write(".");
            }
          } catch {
            // ignore parse errors and retry
          }
        }
      }

      process.stdout.write("\n");

      if (!completed) {
        addResult(
          "Backup artifacts committed",
          "FAILED",
          `Timed out waiting for workflow run ${runId} to complete`
        );
      } else if (conclusion !== "success") {
        addResult(
          "Backup artifacts committed",
          "FAILED",
          `Workflow run ${runId} completed with conclusion: ${conclusion}`
        );
      } else {
        // Verify backup artifacts exist on the tenant branch
        const backupArtifacts = run("git", [
          "ls-tree",
          "-r",
          "--name-only",
          `origin/${tenantName}`,
        ]);

        if (
          backupArtifacts !== undefined &&
          backupArtifacts.split("\n").some(
            (p) => p.startsWith("backups/") && p.endsWith(".json") && !p.slice("backups/".length).includes("/../")
          )
        ) {
          addResult(
            "Backup artifacts committed",
            "PASSED",
            `Found backup artifacts under backups/`
          );
        } else {
          addResult(
            "Backup artifacts committed",
            "FAILED",
            `Workflow succeeded but no backup artifacts found under backups/`
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Final summary and exit code
// ---------------------------------------------------------------------------
const allPassed = printSummary();
process.exit(allPassed ? 0 : 1);
