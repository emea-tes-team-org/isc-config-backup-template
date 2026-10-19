#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Generate README.md from README.template.md + operations dashboard section.
//
// Usage: node scripts/generate-readme.mjs [output-path]
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { loadRegistry } from "./tenant-registry.mjs";
import { generateDashboard, generateRecentBackupTagsSection, generateDashboardFooterLines } from "./generate-dashboard.mjs";
import {
  loadAttemptStatusesFromResults,
  parseAttemptStatusesFromReport,
} from "./generate-report.mjs";
import {
  generateTenantShortcutWorkflows,
  workflowDispatchUrl,
} from "./generate-tenant-shortcuts.mjs";

export { workflowDispatchUrl };

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const PLACEHOLDER = "{{OPS_DASHBOARD}}";

export function resolveRepoSlug(env = process.env) {
  if (env.GITHUB_REPOSITORY) return env.GITHUB_REPOSITORY;
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf-8",
      cwd: root,
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const match = url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (match) return match[1];
  } catch {
    /* fall through */
  }
  return "owner/repo";
}

/**
 * Best-effort fetch of remote restore-point tags so dashboard git lookups
 * match GitHub Tags/Releases. Workflows may still fetch explicitly; this
 * prevents stale Last dates when README is regenerated locally or after merge.
 */
export function fetchBackupTags(options = {}) {
  if (options.fetchTags === false) return;
  const cwd = options.cwd ?? root;
  try {
    execFileSync("git", ["fetch", "origin", "--tags"], {
      encoding: "utf-8",
      cwd,
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch {
    // Fall back to locally available tags when offline or no remote.
  }
}

export function findLatestReport(reportsDir = join(root, "reports")) {
  if (!existsSync(reportsDir)) return null;
  const files = readdirSync(reportsDir)
    .filter((f) => /^backup-summary-\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse();
  return files[0] ? `reports/${files[0]}` : null;
}

export function resolveAttemptStatuses(options = {}, env = process.env) {
  if (options.attemptStatuses) return options.attemptStatuses;
  if (options.resultsJson) return loadAttemptStatusesFromResults(options.resultsJson);
  if (env.BACKUP_RESULTS) return loadAttemptStatusesFromResults(env.BACKUP_RESULTS);

  const latestReport = options.latestReport ?? findLatestReport(options.reportsDir);
  if (latestReport) {
    const reportPath = latestReport.startsWith("/") ? latestReport : join(root, latestReport);
    if (existsSync(reportPath)) {
      return parseAttemptStatusesFromReport(readFileSync(reportPath, "utf-8"));
    }
  }
  return {};
}

export function generateOpsDashboardSection(registry, options = {}) {
  const repoSlug = options.repoSlug ?? resolveRepoSlug();
  const generatedAt = options.generatedAt ?? new Date();
  const gitFunctions = options.gitFunctions;

  const lines = [];
  lines.push("## Operations Dashboard");
  lines.push("");
  lines.push(
    `*Fleet status updated: ${generatedAt.toISOString().replace("T", " ").slice(0, 19)} UTC*`
  );
  lines.push("");

  const attemptStatuses = resolveAttemptStatuses(options);
  const dashboardBody = generateDashboard(registry, gitFunctions, generatedAt, {
    includeRecentTags: false,
    repoSlug,
    attemptStatuses,
  });
  const dashboardLines = dashboardBody.split("\n");
  const skipTitle = dashboardLines[0]?.startsWith("# ") ? 2 : 0;
  lines.push(...dashboardLines.slice(skipTitle));

  lines.push("");
  lines.push("## Quick Actions");
  lines.push("");
  lines.push("| Workflow | Dispatch |");
  lines.push("|----------|----------|");
  lines.push(
    `| ISC Lifecycle | [Run](${workflowDispatchUrl(repoSlug, "isc-lifecycle.yml")}) |`
  );
  lines.push(
    `| ISC Backup | [Run](${workflowDispatchUrl(repoSlug, "isc-backup.yml")}) |`
  );
  lines.push(
    `| ISC Restore | [Run](${workflowDispatchUrl(repoSlug, "isc-restore.yml")}) |`
  );
  lines.push(
    `| ISC Config Tools | [Run](${workflowDispatchUrl(repoSlug, "isc-config-tools.yml")}) |`
  );
  lines.push(
    `| Scheduled Backup | [Run](${workflowDispatchUrl(repoSlug, "scheduled-backup.yml")}) |`
  );
  lines.push(
    `| ISC Maintenance | [Run](${workflowDispatchUrl(repoSlug, "isc-maintenance.yml")}) |`
  );
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(...generateRecentBackupTagsSection(gitFunctions, { repoSlug }).split("\n"));
  lines.push("");
  lines.push(...generateDashboardFooterLines());

  lines.push("");
  lines.push("## Architecture at a glance");
  lines.push("");
  lines.push(
    "- **`main`** holds scripts, `tenants.yaml`, the six operator workflows, generated `README.md`, and backup summary reports."
  );
  lines.push(
    "- **Tenant branches** (named after the tenant) store flat `backups/<TYPE>/<id>.json`, `.tenant.yaml`, and optional `templates/` / `vars/`."
  );
  lines.push(
    "- **Restore-point tags** (`<tenant>/YYYY-MM-DD_HH-MM-SS`) snapshot flat `backups/` for download and cross-tenant restore."
  );
  lines.push(
    "- All workflows run from **`main`**; tenant branches are data-only (no copied workflow files)."
  );

  const latestReport = options.latestReport ?? findLatestReport();
  lines.push("");
  lines.push("## Latest backup report");
  lines.push("");
  if (latestReport) {
    lines.push(`[${latestReport}](${latestReport})`);
  } else {
    lines.push("No backup summary reports committed yet.");
  }

  return lines.join("\n");
}

export async function generateReadme(options = {}) {
  const templatePath = options.templatePath ?? join(root, "README.template.md");
  const template = readFileSync(templatePath, "utf-8");
  if (!template.includes(PLACEHOLDER)) {
    throw new Error(`README.template.md must contain ${PLACEHOLDER}`);
  }

  const registry = options.registry ?? loadRegistry(options.registryPath);
  if (options.syncShortcuts !== false) {
    await generateTenantShortcutWorkflows(registry, { workflowsDir: options.workflowsDir });
  }
  if (!options.gitFunctions) {
    fetchBackupTags(options);
  }
  const opsSection = generateOpsDashboardSection(registry, options);
  return template.replace(PLACEHOLDER, opsSection);
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

function parseArgs(args) {
  const result = {
    outputPath: join(root, "README.md"),
    resultsJson: null,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--results") {
      result.resultsJson = args[++i];
    } else if (!arg.startsWith("-")) {
      result.outputPath = resolve(arg);
    }
  }
  return result;
}

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const content = await generateReadme({ resultsJson: args.resultsJson });
  writeFileSync(args.outputPath, content, "utf-8");
  console.log(`Wrote ${args.outputPath}`);
}
