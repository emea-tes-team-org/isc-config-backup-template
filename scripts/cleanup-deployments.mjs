#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Sweep historical GitHub Deployment records (backup job side effects).
//
// Usage:
//   node scripts/cleanup-deployments.mjs [--environment NAME] [--dry-run]
//
// Environment:
//   GITHUB_REPOSITORY — owner/repo (required outside Actions)
//   GH_TOKEN          — GitHub token with deployments: write
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";

const DEFAULT_PER_PAGE = 100;

function runGh(args, options = {}) {
  return execFileSync("gh", args, {
    encoding: "utf-8",
    stdio: options.stdio ?? ["pipe", "pipe", "pipe"],
    ...options,
  });
}

function encodeEnvironment(name) {
  return encodeURIComponent(name);
}

/**
 * @typedef {{ id: number, environment: string, created_at: string, ref: string }} DeploymentRow
 */

/**
 * @param {string} repo
 * @param {{ environment?: string, perPage?: number }} options
 * @param {(args: string[], options?: object) => string} ghRunner
 * @returns {DeploymentRow[]}
 */
function parseDeploymentTsv(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, environment, created_at, ref] = line.split("\t");
      return {
        id: Number(id),
        environment,
        created_at,
        ref,
      };
    });
}

export function listDeployments(repo, options = {}, ghRunner = runGh) {
  const perPage = options.perPage ?? DEFAULT_PER_PAGE;
  const rows = [];

  for (let page = 1; ; page += 1) {
    let query = `repos/${repo}/deployments?per_page=${perPage}&page=${page}`;
    if (options.environment) {
      query += `&environment=${encodeEnvironment(options.environment)}`;
    }

    const raw = ghRunner(["api", query, "--jq", ".[] | [.id, .environment, .created_at, .ref] | @tsv"]);
    const pageRows = parseDeploymentTsv(raw);
    rows.push(...pageRows);
    if (pageRows.length < perPage) {
      break;
    }
  }

  return rows;
}

/**
 * @param {string} repo
 * @param {number} deploymentId
 * @param {(args: string[], options?: object) => string} ghRunner
 * @returns {boolean}
 */
export function deleteDeploymentRecord(repo, deploymentId, ghRunner = runGh) {
  try {
    ghRunner(
      ["api", "-X", "POST", `repos/${repo}/deployments/${deploymentId}/statuses`, "-f", "state=inactive"],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
  } catch {
    // inactive may fail for already-inactive deployments; continue to delete
  }

  try {
    ghRunner(["api", "-X", "DELETE", `repos/${repo}/deployments/${deploymentId}`], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    return true;
  } catch (err) {
    const message = `${err.stderr ?? ""}${err.stdout ?? ""}${err.message ?? ""}`;
    if (message.includes("Not Found") || message.includes("HTTP 404")) {
      return false;
    }
    console.warn(
      `::warning::Could not delete deployment ${deploymentId}: ${message.trim() || "unknown error"}`
    );
    return false;
  }
}

/**
 * @param {{ repo: string, environment?: string, dryRun?: boolean, ghRunner?: typeof runGh }} params
 * @returns {{ listed: number, deleted: number, rows: DeploymentRow[] }}
 */
export function sweepDeployments({ repo, environment, dryRun = false, ghRunner = runGh }) {
  const rows = listDeployments(repo, { environment }, ghRunner);
  if (dryRun) {
    return { listed: rows.length, deleted: 0, rows };
  }

  let deleted = 0;
  for (const row of rows) {
    if (deleteDeploymentRecord(repo, row.id, ghRunner)) {
      deleted += 1;
    }
  }
  return { listed: rows.length, deleted, rows };
}

function parseArgs(argv) {
  let environment = "";
  let dryRun = false;

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--environment") {
      environment = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/cleanup-deployments.mjs [--environment NAME] [--dry-run]`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { environment: environment || undefined, dryRun };
}

function formatSummary(result, dryRun) {
  const lines = [];
  for (const row of result.rows) {
    lines.push(` id=${row.id} env=${row.environment} created=${row.created_at} ref=${row.ref}`);
  }

  if (lines.length === 0) {
    return "No deployments matched the filter.";
  }

  const header = dryRun
    ? `DRY RUN — would delete ${result.listed} deployment(s):`
    : `Deleted ${result.deleted} of ${result.listed} deployment(s).`;
  return `${header}\n${lines.join("\n")}`;
}

function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) {
    console.error("GITHUB_REPOSITORY is required");
    process.exit(1);
  }

  const { environment, dryRun } = parseArgs(process.argv);
  const result = sweepDeployments({ repo, environment, dryRun });
  console.log(formatSummary(result, dryRun));
}

import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
