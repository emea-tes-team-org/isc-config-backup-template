#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Generate the ISC Backup Dashboard markdown.
//
// Usage: node scripts/generate-dashboard.mjs > DASHBOARD.md
//
// The script reads tenants.yaml, queries git for backup metadata, and writes
// a markdown dashboard to stdout. Core logic is exported for testing.
// ---------------------------------------------------------------------------

import { execFileSync } from "child_process";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { loadRegistry } from "./tenant-registry.mjs";
import { nextCronTime } from "./cron-utils.mjs";
import { BACKUP_DIR } from "./backup-path-utils.mjs";
import { parseTagTimestamp } from "./parse-tenants.mjs";
import {
  tenantShortcutWorkflowFile,
  workflowDispatchUrl,
} from "./generate-tenant-shortcuts.mjs";

function noWrap(value) {
  return `<nobr>${value}</nobr>`;
}

function formatTenantCell(tenant) {
  const name = escapeCell(tenant.name);
  const subLines = [];
  if (tenant.description) subLines.push(escapeCell(tenant.description));
  const hostname = formatHostname(tenant.hostname);
  if (hostname) subLines.push(hostname);
  if (subLines.length === 0) return name;
  return `${name}<br><sub>${subLines.join("<br>")}</sub>`;
}

function formatTimestamp(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|");
}

export function getLatestBackupTagDate(branch) {
  try {
    const output = execFileSync(
      "git",
      ["tag", "--list", `${branch}/*`],
      { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
    );
    let latest = null;
    for (const tag of output.split("\n")) {
      const trimmed = tag.trim();
      if (!trimmed) continue;
      const timestamp = parseTagTimestamp(trimmed);
      if (!timestamp) continue;
      if (!latest || timestamp > latest) latest = timestamp;
    }
    return latest ? latest.toISOString().slice(0, 10) : null;
  } catch {
    return null;
  }
}

export function resolveLastBackupDate(tagDate, commitDate) {
  return tagDate ?? commitDate ?? null;
}

const TRUNK_REFS = ["main", "origin/main"];

let trunkRefCache = null;

/**
 * Trunk refs that exist locally, used to exclude shared history from per-tenant
 * backup lookups. Tenant branches are cut from main, so main's own legacy
 * `backup:` commits are reachable from every tenant branch.
 */
export function resolveTrunkRefs(trunkRefs = TRUNK_REFS) {
  const found = [];
  for (const ref of trunkRefs) {
    try {
      execFileSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], {
        stdio: ["pipe", "pipe", "ignore"],
      });
      found.push(ref);
    } catch {
      // ref not present in this clone
    }
  }
  return found;
}

function getTrunkRefs() {
  if (trunkRefCache === null) trunkRefCache = resolveTrunkRefs();
  return trunkRefCache;
}

export function buildBackupCommitArgs(ref, trunkRefs) {
  const args = ["log", "-1", "--format=%ci", "--grep=^backup: ", ref];
  if (trunkRefs.length > 0) args.push("--not", ...trunkRefs);
  return args;
}

function getLatestBackupCommitDate(branch) {
  const trunkRefs = getTrunkRefs();
  const refs = [branch, `origin/${branch}`];
  for (const ref of refs) {
    const exclusions = trunkRefs.filter((trunk) => trunk !== ref);
    try {
      const output = execFileSync("git", buildBackupCommitArgs(ref, exclusions), {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      const trimmed = output.trim();
      if (trimmed) {
        return trimmed.split(" ")[0];
      }
    } catch {
      // try next ref
    }
  }
  return null;
}

let objectCountCache = null;
let lastBackupDateCache = null;

function getLastBackupDate(branch) {
  if (lastBackupDateCache !== null && lastBackupDateCache.has(branch)) {
    return lastBackupDateCache.get(branch);
  }
  // ⚡ Bolt: Lazily evaluate the fallback git subprocess
  // Impact: Avoids ~20ms git process spawn per tenant when tag is present (O(N) to O(1) in best case)
  const tagDate = getLatestBackupTagDate(branch);
  return resolveLastBackupDate(
    tagDate,
    tagDate ? null : getLatestBackupCommitDate(branch)
  );
}

// Legacy alias used by tests and callers that stub git lookups.
function getLastCommitDate(branch) {
  return getLastBackupDate(branch);
}

// ⚡ Bolt: Fetch all object counts and dates in a single sh process
// Impact: Reduces git process spawns from O(N) to 1.
function preloadObjectCounts(tenants) {
  objectCountCache = new Map();
  lastBackupDateCache = new Map();
  if (!tenants || tenants.length === 0) return;

  const args = [];
  for (const t of tenants) {
    args.push(t.name);
  }

  const script = `
    while [ "$#" -gt 0 ]; do
      branch="$1"
      shift
      count=0
      cdate=""
      for ref in "$branch" "origin/$branch"; do
        if git rev-parse --verify --quiet "$ref" >/dev/null 2>&1; then
          count=$(git ls-tree -r --name-only "$ref" -- "${BACKUP_DIR}/" 2>/dev/null | grep '\\.json$' | wc -l)
          count=$(echo $count | tr -d ' ')

          cdate=$(git log "$ref" -1 --format=%ci --grep="^backup: " 2>/dev/null | cut -d' ' -f1)

          break
        fi
      done

      tdate=$(git tag --list "$branch/*" --format="%(refname:short)" 2>/dev/null | awk -F'/' '{print $2}' | sort -r | head -n 1 | cut -d'_' -f1)

      echo "$branch|$count|$cdate|$tdate"
    done
  `;

  try {
    const output = execFileSync(
      "sh",
      ["-c", script, "sh", ...args],
      { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
    );
    for (const line of output.trim().split("\n")) {
      if (!line) continue;
      const [branch, count, cdate, tdate] = line.split("|");
      if (branch) {
        if (count !== undefined) {
          objectCountCache.set(branch, parseInt(count, 10) || 0);
        }

        let finalDate = null;
        if (tdate && cdate) {
           finalDate = tdate > cdate ? tdate : cdate;
        } else if (tdate) {
           finalDate = tdate;
        } else if (cdate) {
           finalDate = cdate;
        }

        if (finalDate) {
          lastBackupDateCache.set(branch, finalDate);
        }
      }
    }
  } catch (err) {
    // silently fallback on error
  }
}

function clearObjectCountsCache() {
  objectCountCache = null;
  lastBackupDateCache = null;
}

function getObjectCount(branch) {
  if (objectCountCache !== null && objectCountCache.has(branch)) {
    return objectCountCache.get(branch);
  }

  const refs = [branch, `origin/${branch}`];
  for (const ref of refs) {
    try {
      const output = execFileSync(
        "git",
        ["ls-tree", "-r", "--name-only", ref, "--", `${BACKUP_DIR}/`],
        { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
      );
      return output
        .split("\n")
        .filter((line) => line.trim().endsWith(".json"))
        .length;
    } catch {
      // try next ref
    }
  }
  return 0;
}

/**
 * Sort backup tags by name-embedded UTC timestamp (newest first).
 * Matches parse-tenants and prune-tags — not git creatordate, which can
 * diverge after branch squash or backups-only retagging.
 */
export function listRecentBackupTags(tags, limit = 20) {
  return tags
    .map((tag) => {
      const ts = parseTagTimestamp(tag);
      if (!ts) return null;
      return { tag, date: formatTimestamp(ts) };
    })
    .filter(Boolean)
    .sort((a, b) => parseTagTimestamp(b.tag).getTime() - parseTagTimestamp(a.tag).getTime())
    .slice(0, limit);
}

function getRecentTags(limit = 20) {
  try {
    const output = execFileSync(
      "git",
      ["tag", "-l", "--format=%(refname:short)"],
      { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
    );
    const tags = output.trim().split("\n").filter(Boolean);
    return listRecentBackupTags(tags, limit);
  } catch {
    return [];
  }
}

export const defaultGitFunctions = {
  getLastBackupDate,
  getLastCommitDate,
  getLatestBackupTagDate,
  getObjectCount,
  getRecentTags,
};

export function tagReleaseUrl(repoSlug, tag) {
  return `https://github.com/${repoSlug}/releases/tag/${encodeURIComponent(tag)}`;
}

export function generateRecentBackupTagsSection(gitFunctions = defaultGitFunctions, options = {}) {
  const lines = [];
  lines.push("## Recent Backup Tags");
  lines.push("");

  const tags = gitFunctions.getRecentTags(20);
  if (tags.length === 0) {
    lines.push("No backup tags found.");
  } else {
    const repoSlug = options.repoSlug;
    for (const { tag, date } of tags) {
      const label = `\`${tag}\``;
      const name = repoSlug ? `[${label}](${tagReleaseUrl(repoSlug, tag)})` : label;
      lines.push(`- ${name} (${date} UTC)`);
    }
  }

  return lines.join("\n");
}

export function generateDashboardFooterLines() {
  return [
    "---",
    "",
    "*Use `node scripts/parse-tenants.mjs --list` to see all registered tenants.*",
  ];
}

function formatNextBackup(tenant, now) {
  if (tenant.active === false) return "—";
  if (!tenant.schedule) return "daily";
  const next = nextCronTime(tenant.schedule, now);
  if (!next) return "—";
  return formatTimestamp(next).slice(0, 16);
}

function formatHostname(hostname) {
  if (!hostname) return null;
  return escapeCell(hostname).replace(/\.api\./, ".api.<br>");
}

export function formatTenantState(tenant, lastBackup, objectCount, attemptStatus) {
  if (tenant.active === false) return "❌";
  if (attemptStatus === "failed") return "⚠️ Backup failed";
  if (lastBackup === null) return "⚠️ No backups";
  if (objectCount === 0) return "⚠️ Empty backup";
  return "✅ Healthy";
}

const ACTION_ICONS = {
  backup: "💾",
  toggle: "⏸",
  verify: "✓",
  offboard: "✕",
};

function formatTenantActions(tenantName, repoSlug) {
  const link = (kind) =>
    `[${ACTION_ICONS[kind]}](${workflowDispatchUrl(repoSlug, tenantShortcutWorkflowFile(tenantName, kind))})`;
  return `<sub>${link("backup")} · ${link("toggle")} · ${link("verify")} · ${link("offboard")}</sub>`;
}

function renderTenantRow(tenant, gitFunctions, now, repoSlug, attemptStatuses = {}) {
  const lastBackup =
    gitFunctions.getLastBackupDate?.(tenant.name) ??
    gitFunctions.getLastCommitDate(tenant.name);
  const objectCount = gitFunctions.getObjectCount(tenant.name);
  const attemptStatus = attemptStatuses[tenant.name];

  const nextBackup = formatNextBackup(tenant, now);
  const actions = repoSlug ? formatTenantActions(tenant.name, repoSlug) : null;

  const cells = [
    formatTenantCell(tenant),
    noWrap(lastBackup === null ? "Never" : lastBackup),
    noWrap(nextBackup),
    noWrap(objectCount),
    noWrap(formatTenantState(tenant, lastBackup, objectCount, attemptStatus)),
  ];
  if (actions) cells.push(noWrap(actions));

  return `| ${cells.join(" | ")} |`;
}

export function generateDashboard(
  registry,
  gitFunctions = defaultGitFunctions,
  generatedAt = new Date(),
  options = {}
) {
  // Preload objects if we're using the default git functions (i.e. not mocked)
  if (gitFunctions === defaultGitFunctions) {
    preloadObjectCounts(registry.tenants);
  }

  try {
    const lines = [];
    lines.push("# 📊 ISC Backup Dashboard");
    lines.push("");
    lines.push(`*Generated: ${formatTimestamp(generatedAt)} UTC*`);
    lines.push("");

    if (!registry.tenants || registry.tenants.length === 0) {
      lines.push("No tenants found.");
      return lines.join("\n");
    }

    lines.push("## Tenant Overview");
    lines.push("");
    const repoSlug = options.repoSlug;
    const attemptStatuses = options.attemptStatuses ?? {};
    const header = `| Tenant | ${noWrap("Last")} | ${noWrap("Next")} | ${noWrap("#")} | ${noWrap("State")} |`;
    const separator = "|--------|------|------|---|-------|";
    const actionsHeader = ` ${noWrap(`${ACTION_ICONS.backup} ${ACTION_ICONS.toggle} ${ACTION_ICONS.verify} ${ACTION_ICONS.offboard}`)} |`;
    const actionsSeparator = " :---: |";
    if (repoSlug) {
      lines.push(`${header}${actionsHeader}`);
      lines.push(`${separator}${actionsSeparator}`);
    } else {
      lines.push(header);
      lines.push(separator);
    }

    for (const tenant of registry.tenants) {
      lines.push(renderTenantRow(tenant, gitFunctions, generatedAt, repoSlug, attemptStatuses));
    }

    if (options.includeRecentTags !== false) {
      lines.push("");
      lines.push("---");
      lines.push("");
      lines.push(...generateRecentBackupTagsSection(gitFunctions, { repoSlug }).split("\n"));
      lines.push("");
      lines.push(...generateDashboardFooterLines());
    }

    return lines.join("\n");
  } finally {
    if (gitFunctions === defaultGitFunctions) {
      clearObjectCountsCache();
    }
  }
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const registry = loadRegistry();
  console.log(generateDashboard(registry));
}

