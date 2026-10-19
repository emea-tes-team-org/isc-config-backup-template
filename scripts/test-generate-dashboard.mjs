#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for scripts/generate-dashboard.mjs
//
// Usage: node scripts/test-generate-dashboard.mjs
// ---------------------------------------------------------------------------

import {
  buildBackupCommitArgs,
  defaultGitFunctions,
  generateDashboard,
  getLatestBackupTagDate,
  listRecentBackupTags,
  resolveLastBackupDate,
} from "./generate-dashboard.mjs";
import { assert, finalizeTests } from "./test-utils.mjs";

function makeGitFunctions({ lastCommit, objectCount, tags, lastBackup = lastCommit }) {
  return {
    getLastBackupDate: () => lastBackup,
    getLastCommitDate: () => lastCommit,
    getObjectCount: () => objectCount,
    getRecentTags: () => tags,
  };
}

console.log("Testing generate-dashboard.mjs...\n");

// Test: Active tenant with backups
{
  const registry = {
    tenants: [{ name: "company12926-poc", active: true, hostname: "company12926-poc.identitynow-demo.com", schedule: "0 6 * * *" }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({
      lastCommit: "2026-06-18",
      objectCount: 394,
      tags: [],
    }),
    new Date("2026-06-18T14:20:09Z")
  );

  assert(markdown.includes("| company12926-poc<br><sub>company12926-poc.identitynow-demo.com</sub> | <nobr>2026-06-18</nobr> | <nobr>2026-06-19 06:00</nobr> | <nobr>394</nobr> | <nobr>✅ Healthy</nobr> |"), "Active tenant with backups renders correct row");
}

// Test: Active tenant without backups
{
  const registry = {
    tenants: [{ name: "company12926-poc", active: true, hostname: "company12926-poc.identitynow-demo.com", schedule: "0 6 * * *" }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({
      lastCommit: "2026-06-18",
      objectCount: 0,
      tags: [],
    }),
    new Date("2026-06-18T14:20:09Z")
  );

  assert(markdown.includes("| company12926-poc<br><sub>company12926-poc.identitynow-demo.com</sub> | <nobr>2026-06-18</nobr> | <nobr>2026-06-19 06:00</nobr> | <nobr>0</nobr> | <nobr>⚠️ Empty backup</nobr> |"), "Active tenant without backups shows empty backup status");
}

// Test: Inactive tenant
{
  const registry = {
    tenants: [{ name: "company12926-poc", active: false }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({
      lastCommit: null,
      objectCount: 0,
      tags: [],
    }),
    new Date("2026-06-18T14:20:09Z")
  );

  assert(markdown.includes("| company12926-poc | <nobr>Never</nobr> | <nobr>—</nobr> | <nobr>0</nobr> | <nobr>❌</nobr> |"), "Inactive tenant without backups shows correct row");
}

// Test: Description with pipe character is escaped under tenant name
{
  const registry = {
    tenants: [{ name: "company12926-poc", active: true, description: "A | B" }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({
      lastCommit: "2026-06-18",
      objectCount: 1,
      tags: [],
    }),
    new Date("2026-06-18T14:20:09Z")
  );

  assert(markdown.includes("company12926-poc<br><sub>A \\| B</sub>"), "Pipe character in description is escaped");
}

// Test: Hostname with pipe character is escaped
{
  const registry = {
    tenants: [{ name: "company12926-poc", active: true, hostname: "host | example.com" }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({
      lastCommit: "2026-06-18",
      objectCount: 1,
      tags: [],
    }),
    new Date("2026-06-18T14:20:09Z")
  );

  assert(markdown.includes("company12926-poc<br><sub>host \\| example.com</sub>"), "Pipe character in hostname is escaped");
}

// Test: Tenant with hostname shows it in the row
{
  const registry = {
    tenants: [{ name: "axa", active: true, hostname: "axa.identitynow-demo.com" }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({ lastCommit: "2026-06-18", objectCount: 1, tags: [] }),
    new Date("2026-06-18T14:20:09Z")
  );

  assert(markdown.includes("| axa<br><sub>axa.identitynow-demo.com</sub> |"), "Tenant with hostname shows it under tenant name");
}

// Test: Tenant without hostname shows em-dash
{
  const registry = {
    tenants: [{ name: "no-host", active: true }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({ lastCommit: "2026-06-18", objectCount: 1, tags: [] }),
    new Date("2026-06-18T14:20:09Z")
  );

  assert(markdown.includes("| no-host |"), "Tenant without hostname shows name only");
  assert(!markdown.includes("| no-host | — |"), "Tenant without hostname has no em-dash column");
}

// Test: Scheduled tenant next-backup is formatted
{
  const registry = {
    tenants: [{ name: "company12926-poc", active: true, schedule: "0 6 * * *" }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({ lastCommit: "2026-06-18", objectCount: 1, tags: [] }),
    new Date("2026-06-19T12:00:09Z")
  );

  assert(markdown.includes("2026-06-20 06:00"), "Scheduled tenant shows formatted next backup");
}

// Test: Daily-default tenant shows "daily"
{
  const registry = {
    tenants: [{ name: "axa", active: true }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({ lastCommit: "2026-06-18", objectCount: 1, tags: [] }),
    new Date("2026-06-19T12:00:09Z")
  );

  assert(markdown.includes("| axa | <nobr>2026-06-18</nobr> | <nobr>daily</nobr> | <nobr>1</nobr> | <nobr>✅ Healthy</nobr> |"), "Daily-default tenant shows literal 'daily'");
}

// Test: Recent backup tags
{
  const registry = {
    tenants: [{ name: "company12926-poc", active: true }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({
      lastCommit: "2026-06-18",
      objectCount: 1,
      tags: [
        { tag: "company12926-poc/2026-06-18_07-32-36", date: "2026-06-18 07:32:36" },
        { tag: "company21280-poc/2026-06-18_08-40-16", date: "2026-06-18 08:40:16" },
      ],
    }),
    new Date("2026-06-18T14:20:09Z")
  );

  assert(markdown.includes("- `company12926-poc/2026-06-18_07-32-36` (2026-06-18 07:32:36 UTC)"), "Recent backup tags are listed");
  assert(markdown.includes("- `company21280-poc/2026-06-18_08-40-16` (2026-06-18 08:40:16 UTC)"), "Multiple backup tags are listed");
}

// Test: Recent backup tags link to GitHub Release URLs when repoSlug provided
{
  const registry = {
    tenants: [{ name: "company12926-poc", active: true }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({
      lastCommit: "2026-06-18",
      objectCount: 1,
      tags: [
        { tag: "company12926-poc/2026-06-18_07-32-36", date: "2026-06-18 07:32:36" },
      ],
    }),
    new Date("2026-06-18T14:20:09Z"),
    { repoSlug: "org/repo" }
  );

  assert(
    markdown.includes(
      "- [`company12926-poc/2026-06-18_07-32-36`](https://github.com/org/repo/releases/tag/company12926-poc%2F2026-06-18_07-32-36) (2026-06-18 07:32:36 UTC)"
    ),
    "Recent backup tags link to the GitHub Release for that tag"
  );
}

// Test: Recent backup tags sort by embedded timestamp, not creatordate
{
  const sorted = listRecentBackupTags([
    "ksb/2026-08-03_00-10-54",
    "ksb/2026-08-03_03-51-57",
    "ksb/2026-08-02_01-13-51",
  ], 3);

  assert(sorted[0].tag === "ksb/2026-08-03_03-51-57", "Newest embedded timestamp listed first");
  assert(sorted[1].tag === "ksb/2026-08-03_00-10-54", "Same-day tags ordered by embedded time");
  assert(sorted[2].tag === "ksb/2026-08-02_01-13-51", "Older embedded timestamp listed last");
  assert(
    sorted[1].date === "2026-08-03 00:10:54",
    "Displayed timestamp matches tag name, not git creatordate"
  );
}

// Test: Hostname breaks at .api. for narrower table cells
{
  const registry = {
    tenants: [{ name: "fernando", active: true, hostname: "company12926-poc.api.identitynow-demo.com" }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({ lastCommit: "2026-06-18", objectCount: 1, tags: [] }),
    new Date("2026-06-18T14:20:09Z")
  );

  assert(
    markdown.includes("fernando<br><sub>company12926-poc.api.<br>identitynow-demo.com</sub>"),
    "Hostname breaks at .api. boundary under tenant name"
  );
}

// Test: restore-point tag date helper parses tenant tag names
{
  const date = getLatestBackupTagDate("fernando");
  if (date) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(date), "getLatestBackupTagDate returns YYYY-MM-DD when tags exist");
  } else {
    console.log("SKIP: no local fernando backup tags to exercise getLatestBackupTagDate");
  }
}

// Test: Last prefers restore-point tag date over an older backup commit
{
  assert(
    resolveLastBackupDate("2026-08-13", "2026-08-12") === "2026-08-13",
    "Last prefers restore-point tag date over older backup commit"
  );
  assert(
    resolveLastBackupDate(null, "2026-08-12") === "2026-08-12",
    "Last falls back to backup commit date when no tag exists"
  );
  assert(
    resolveLastBackupDate(null, null) === null,
    "Last is null when no tag or backup commit exists"
  );
}

// Test: production Last lookup uses tag date when tags exist
{
  const tagDate = getLatestBackupTagDate("fernando");
  if (tagDate) {
    assert(
      defaultGitFunctions.getLastBackupDate("fernando") === tagDate,
      "getLastBackupDate returns latest restore-point tag date, not older backup commit"
    );
  } else {
    console.log("SKIP: no local fernando backup tags to exercise getLastBackupDate");
  }
}

// Test: backup commit lookup excludes history shared with trunk
{
  const args = buildBackupCommitArgs("company8480-poc", ["main", "origin/main"]);

  assert(
    args.join(" ").endsWith("company8480-poc --not main origin/main"),
    "Backup commit lookup excludes trunk refs so main's legacy backups are ignored"
  );
  assert(
    buildBackupCommitArgs("company8480-poc", []).join(" ") ===
      "log -1 --format=%ci --grep=^backup:  company8480-poc",
    "Backup commit lookup omits --not when no trunk ref is available"
  );
}

// Test: a freshly onboarded tenant reports no backups rather than trunk's date
{
  const registry = {
    tenants: [{ name: "company8480-poc", active: true, schedule: "0 0 * * *" }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({ lastCommit: null, lastBackup: null, objectCount: 0, tags: [] }),
    new Date("2026-08-27T18:00:00Z")
  );

  assert(
    markdown.includes("| company8480-poc | <nobr>Never</nobr> |"),
    "Newly onboarded tenant with no backups of its own shows Never"
  );
  assert(
    markdown.includes("⚠️ No backups"),
    "Newly onboarded tenant with no backups shows the no-backups state"
  );
}

// Test: Fleet table Actions column when repoSlug provided
{
  const registry = {
    tenants: [{ name: "fernando", active: true, hostname: "demo.example.com" }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({ lastCommit: "2026-06-18", objectCount: 10, tags: [] }),
    new Date("2026-06-18T14:20:09Z"),
    { repoSlug: "org/repo" }
  );

  assert(
    markdown.includes("| Tenant | <nobr>Last</nobr> | <nobr>Next</nobr> | <nobr>#</nobr> | <nobr>State</nobr> | <nobr>💾 ⏸ ✓ ✕</nobr> |"),
    "Actions column header uses nowrap on compact columns"
  );
  assert(
    markdown.includes("<nobr><sub>[💾](") &&
      markdown.includes("isc-backup-fernando.yml") &&
      markdown.includes("isc-toggle-fernando.yml") &&
      markdown.includes("isc-verify-fernando.yml") &&
      markdown.includes("isc-offboard-fernando.yml"),
    "Actions column links to all tenant shortcut workflows as icon-only links"
  );
  assert(markdown.includes("[✕](https://github.com/org/repo/actions/workflows/isc-offboard-fernando.yml)"), "Offboard action link is correct");
}

// Test: Header and footer
{
  const registry = {
    tenants: [{ name: "company12926-poc", active: true }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({ lastCommit: "2026-06-18", objectCount: 1, tags: [] }),
    new Date("2026-06-18T14:20:09Z")
  );

  assert(markdown.startsWith("# 📊 ISC Backup Dashboard"), "Output starts with dashboard title");
  assert(markdown.includes("*Generated: 2026-06-18 14:20:09 UTC*"), "Generated timestamp is present");
  assert(markdown.includes("## Tenant Overview"), "Tenant overview section is present");
  assert(markdown.includes("## Recent Backup Tags"), "Recent backup tags section is present");
}

// Test: failed backup attempt shows unhealthy state
{
  const registry = {
    tenants: [{ name: "ksb", active: true, hostname: "company23128-poc.api.identitynow.com" }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({ lastCommit: "2026-08-13", objectCount: 264, tags: [] }),
    new Date("2026-08-14T10:00:00Z"),
    { attemptStatuses: { ksb: "failed" } }
  );
  assert(markdown.includes("⚠️ Backup failed"), "Failed attempt shows backup failed state");
  assert(!markdown.includes("✅ Healthy"), "Failed attempt is not healthy");
}

// Test: unchanged attempt remains healthy
{
  const registry = {
    tenants: [{ name: "fernando", active: true }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({ lastCommit: "2026-08-13", objectCount: 10, tags: [] }),
    new Date("2026-08-14T10:00:00Z"),
    { attemptStatuses: { fernando: "unchanged" } }
  );
  assert(markdown.includes("✅ Healthy"), "Unchanged attempt remains healthy");
}

// Test: no attempt status falls back to git metadata health
{
  const registry = {
    tenants: [{ name: "andre", active: true }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({ lastCommit: "2026-08-13", objectCount: 5, tags: [] }),
    new Date("2026-08-14T10:00:00Z")
  );
  assert(markdown.includes("✅ Healthy"), "No attempt status keeps git-based healthy state");
}

// Test: inactive tenant unchanged when attempt failed
{
  const registry = {
    tenants: [{ name: "company19271-poc", active: false }],
  };
  const markdown = generateDashboard(
    registry,
    makeGitFunctions({ lastCommit: null, objectCount: 0, tags: [] }),
    new Date("2026-08-14T10:00:00Z"),
    { attemptStatuses: { "company19271-poc": "failed" } }
  );
  assert(markdown.includes("❌"), "Inactive tenant stays inactive even with failed attempt");
}

finalizeTests();
