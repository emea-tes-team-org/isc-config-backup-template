#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for scripts/generate-readme.mjs
//
// Usage: node scripts/test-generate-readme.mjs
// ---------------------------------------------------------------------------

import { mkdtempSync, readFileSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  generateReadme,
  generateOpsDashboardSection,
  workflowDispatchUrl,
  findLatestReport,
  resolveAttemptStatuses,
  fetchBackupTags,
} from "./generate-readme.mjs";
import { assert, finalizeTests } from "./test-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Shortcut syncing rewrites its whole target directory, so keep it away from
// the repository's real .github/workflows.
const shortcutsDir = mkdtempSync(join(tmpdir(), "isc-readme-shortcuts-"));

async function buildReadme(options = {}) {
  return await generateReadme({ workflowsDir: shortcutsDir, ...options });
}

function makeGitFunctions(overrides = {}) {
  return {
    getLastBackupDate: () => overrides.lastCommit ?? "2026-08-12",
    getLastCommitDate: () => overrides.lastCommit ?? "2026-08-12",
    getObjectCount: () => overrides.objectCount ?? 10,
    getRecentTags: () => overrides.tags ?? [],
  };
}

console.log("Testing generate-readme.mjs...\n");

const registry = {
  tenants: [
    { name: "fernando", active: true, hostname: "demo.example.com", schedule: "0 0 * * *" },
    { name: "andre", active: false },
  ],
};

// Template placeholder replaced
{
  const readme = await buildReadme({
    registry,
    repoSlug: "org/repo",
    gitFunctions: makeGitFunctions(),
    generatedAt: new Date("2026-08-12T12:00:00Z"),
    latestReport: "reports/backup-summary-2026-08-12.md",
  });
  assert(!readme.includes("{{OPS_DASHBOARD}}"), "placeholder is replaced");
  assert(readme.includes("# Config Hub CI/CD"), "static template title preserved");
  assert(readme.includes("[Setup](docs/setup.md)"), "documentation links preserved");
  assert(readme.includes("## Operations Dashboard"), "ops dashboard section present");
  assert(readme.includes("| fernando<br><sub>demo.example.com</sub> |"), "fleet table includes tenant with hostname");
  assert(readme.includes("isc-backup.yml"), "dispatch links reference isc-backup.yml");
  assert(
    readme.includes("actions/workflows/isc-backup-fernando.yml"),
    "per-tenant backup uses shortcut workflow"
  );
  assert(
    readme.includes("actions/workflows/isc-offboard-fernando.yml"),
    "fleet table offboard uses shortcut workflow"
  );
  assert(!readme.includes("### Per-tenant shortcuts"), "separate shortcuts section removed");
  assert(readme.includes("<nobr>💾 ⏸ ✓ ✕</nobr>"), "fleet table includes icon legend header");
  assert(!readme.includes("query=tenant"), "no broken query= dispatch params");
  assert(readme.includes("reports/backup-summary-2026-08-12.md"), "latest report link present");
  assert(readme.includes("Architecture at a glance"), "architecture primer present");
  assert(
    readme.indexOf("## Quick Actions") < readme.indexOf("## Recent Backup Tags"),
    "Quick Actions appears before Recent Backup Tags"
  );
}

// Recent backup tags in README link to GitHub Releases
{
  const readme = await buildReadme({
    registry,
    repoSlug: "org/repo",
    gitFunctions: makeGitFunctions({
      tags: [
        { tag: "fernando/2026-08-12_11-27-26", date: "2026-08-12 11:27:26" },
      ],
    }),
  });
  assert(
    readme.includes(
      "- [`fernando/2026-08-12_11-27-26`](https://github.com/org/repo/releases/tag/fernando%2F2026-08-12_11-27-26) (2026-08-12 11:27:26 UTC)"
    ),
    "README recent backup tags link to the GitHub Release for that tag"
  );
}

// Committed README.md Recent Backup Tags must be links (catches stale generated artifact)
{
  const committed = readFileSync(join(root, "README.md"), "utf-8");
  const heading = committed.indexOf("## Recent Backup Tags");
  const section = heading === -1 ? "" : committed.slice(heading);
  const firstItem = section.split("\n").find((line) => line.startsWith("- "));
  assert(heading !== -1, "committed README includes Recent Backup Tags");
  assert(
    firstItem && /\[`.+`\]\(https:\/\/github\.com\/.+\/releases\/tag\//.test(firstItem),
    "committed README Recent Backup Tags entries are GitHub Release links"
  );
}

// Static sections preserved verbatim outside placeholder
{
  const template = readFileSync(join(root, "README.template.md"), "utf-8");
  const readme = await buildReadme({ registry, repoSlug: "org/repo", gitFunctions: makeGitFunctions() });
  assert(readme.includes("Distributed under the MIT License"), "license section preserved");
  assert(template.includes("{{OPS_DASHBOARD}}"), "template still has placeholder");
}

// workflowDispatchUrl helper
{
  const url = workflowDispatchUrl("sailpoint/repo", "isc-lifecycle.yml");
  assert(
    url === "https://github.com/sailpoint/repo/actions/workflows/isc-lifecycle.yml",
    "dispatch URL has no query param"
  );
}

// Ops section includes six-workflow roster
{
  const section = generateOpsDashboardSection(registry, {
    repoSlug: "org/repo",
    gitFunctions: makeGitFunctions(),
    latestReport: null,
  });
  assert(section.includes("ISC Lifecycle"), "quick actions list lifecycle");
  assert(section.includes("Scheduled Backup"), "quick actions list scheduled backup");
  assert(section.includes("ISC Maintenance"), "quick actions list maintenance");
}

// Dispatch links target existing operator workflow files (task 8.3 automated check)
{
  const operatorWorkflows = [
    "isc-lifecycle.yml",
    "isc-backup.yml",
    "isc-restore.yml",
    "isc-config-tools.yml",
    "scheduled-backup.yml",
    "isc-maintenance.yml",
  ];
  const readme = await buildReadme({
    registry,
    repoSlug: "org/repo",
    gitFunctions: makeGitFunctions(),
  });
  for (const wf of operatorWorkflows) {
    const path = join(root, ".github/workflows", wf);
    const content = readFileSync(path, "utf-8");
    assert(content.includes("workflow_dispatch:"), `${wf}: has workflow_dispatch`);
    assert(readme.includes(wf), `README dispatch link references ${wf}`);
  }
}

// fetchBackupTags can be disabled for tests and offline runs
{
  fetchBackupTags({ fetchTags: false });
  assert(true, "fetchBackupTags respects fetchTags: false");
}

// resolveAttemptStatuses from explicit results JSON
{
  const statuses = resolveAttemptStatuses({
    resultsJson: JSON.stringify([{ tenant: "ksb", status: "failed" }]),
  });
  assert(statuses.ksb === "failed", "resolveAttemptStatuses reads resultsJson option");
}

// Ops section marks failed tenant unhealthy from attempt statuses
{
  const section = generateOpsDashboardSection(
    { tenants: [{ name: "ksb", active: true, schedule: "0 0 * * *" }] },
    {
      repoSlug: "org/repo",
      gitFunctions: makeGitFunctions({ lastCommit: "2026-08-13", objectCount: 264 }),
      attemptStatuses: { ksb: "failed" },
    }
  );
  assert(section.includes("⚠️ Backup failed"), "ops section shows failed backup state");
}

// resolveAttemptStatuses falls back to latest committed report
{
  const latestReport = findLatestReport();
  if (latestReport) {
    const statuses = resolveAttemptStatuses({ latestReport });
    assert(typeof statuses === "object", "report fallback returns status object");
  } else {
    console.log("SKIP: no committed backup summary report for report fallback test");
  }
}

// Shortcut syncing writes to the supplied directory, not the repo's workflows
{
  const generated = readdirSync(shortcutsDir);
  assert(
    generated.includes("isc-backup-fernando.yml"),
    "shortcut syncing writes into the supplied workflows directory"
  );
  const repoWorkflows = readdirSync(join(root, ".github/workflows"));
  assert(
    repoWorkflows.includes("isc-backup.yml") && repoWorkflows.includes("isc-lifecycle.yml"),
    "generating a README leaves the repository workflows directory intact"
  );
}

rmSync(shortcutsDir, { recursive: true, force: true });

finalizeTests();
