#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Parse tenants.yaml and output JSON for GitHub Actions matrix strategy
//
// Usage: node scripts/parse-tenants.mjs [options]
//   --active-only    Output only tenants with active: true (default)
//   --all            Output all tenants regardless of active status
//   --json           Output raw JSON (default)
//   --count          Output just the count
//   --check-schedule Filter tenants within their schedule window (scheduled time + retry band)
//   --check-pending  Filter tenants whose backup is pending (not yet run for current window)
//   --tenant <name>  Filter for a specific tenant by name
//
// Output format for GitHub Actions matrix:
//   {"include":[{"tenant":"name","branch":"branch","environment":"env",...}]}
// ---------------------------------------------------------------------------

import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { loadRegistry, resolveExportPollMinutes, resolveJobTimeoutMinutes } from "./tenant-registry.mjs";
import { previousCronTime, nextCronTime } from "./cron-utils.mjs";

const MS_PER_MINUTE = 60_000;
// Must cover scheduled-backup.yml retry crons (through 01:45 UTC) plus GitHub Actions
// schedule delay, which can push the midnight run well past the last retry slot.
const SCHEDULE_RETRY_WINDOW_MS = 360 * MS_PER_MINUTE;

// Cache all tags globally so we don't spawn a git process for each tenant
let latestTagMapCache = null;
let branchBackupTimeCache = null;

export function preloadBranchBackupTimes(tenants) {
  branchBackupTimeCache = new Map();
  if (!tenants || tenants.length === 0) return;

  const args = [];
  for (const t of tenants) {
    args.push(t.name);
  }

  const script = `
    for tenant in "$@"; do
      if git rev-parse --verify --quiet "origin/$tenant" >/dev/null 2>&1; then
        time=$(git log "origin/$tenant" -1 --format=%cI --grep="^backup: " 2>/dev/null)
        if [ -n "$time" ]; then
          echo "$tenant|$time"
        fi
      fi
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
      const [tenant, time] = line.split("|");
      if (tenant && time) {
        branchBackupTimeCache.set(tenant, time);
      }
    }
  } catch (err) {
    branchBackupTimeCache = null;
  }
}

/**
 * Parse UTC timestamp embedded in tag name: <tenant>/YYYY-MM-DD_HH-MM-SS
 */
export function parseTagTimestamp(tagName) {
  const match = tagName.match(/\/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  return new Date(Date.UTC(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    parseInt(second, 10)
  ));
}

/**
 * Build tenant → latest-tag map from tag names using max embedded timestamp.
 */
export function buildLatestTagMapFromTags(tags) {
  const map = new Map();
  for (const tag of tags) {
    const slashIndex = tag.indexOf("/");
    if (slashIndex === -1) continue;

    const tenant = tag.slice(0, slashIndex);
    const ts = parseTagTimestamp(tag);
    if (!ts) continue;

    const existing = map.get(tenant);
    if (!existing) {
      map.set(tenant, tag);
      continue;
    }

    const existingTs = parseTagTimestamp(existing);
    if (!existingTs || ts.getTime() > existingTs.getTime()) {
      map.set(tenant, tag);
    }
  }
  return map;
}

function getLatestTagMap() {
  if (latestTagMapCache === null) {
    latestTagMapCache = new Map();
    try {
      const output = execFileSync(
        "git",
        ["tag", "-l", "--format=%(refname:short)"],
        { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
      );
      const tags = output.trim().split("\n").filter(Boolean);
      latestTagMapCache = buildLatestTagMapFromTags(tags);
    } catch {
      // Keep map empty on error
    }
  }
  return latestTagMapCache;
}

/**
 * Find the latest backup tag timestamp for a tenant.
 * Tag format: <tenant>/YYYY-MM-DD_HH-MM-SS
 */
export function getLatestTagBackupTime(tenant, tagMap = getLatestTagMap()) {
  try {
    const latestTag = tagMap.get(tenant);
    if (!latestTag) return null;
    return parseTagTimestamp(latestTag);
  } catch {
    return null;
  }
}

/**
 * Find the latest backup commit timestamp on the tenant branch.
 * Matches commit messages like "backup: YYYY-MM-DD ..."
 */
export function getLatestBranchBackupTime(tenant, runGit = runGitLog) {
  try {
    const output = runGit(tenant);
    const trimmed = output.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function runGitLog(tenant) {
  if (branchBackupTimeCache !== null) {
    return branchBackupTimeCache.get(tenant) || "";
  }
  return execFileSync(
    "git",
    ["log", `origin/${tenant}`, "-1", "--format=%cI", "--grep=^backup: "],
    { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
  );
}

/**
 * True when now is at or after today's scheduled time and still within the
 * workflow retry band (see scheduled-backup.yml cron entries).
 */
export function isWithinScheduleWindow(schedule, now, retryWindowMs = SCHEDULE_RETRY_WINDOW_MS) {
  const scheduledTime = getCurrentWindowScheduledTime(schedule, now);
  if (!scheduledTime) return false;
  return now.getTime() - scheduledTime.getTime() <= retryWindowMs;
}

/**
 * Scheduled time for the current backup window, or null if the window has not opened yet.
 */
function getCurrentWindowScheduledTime(schedule, now) {
  const startOfDay = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  const firstToday = nextCronTime(schedule, new Date(startOfDay.getTime() - MS_PER_MINUTE));
  if (firstToday && now.getTime() < firstToday.getTime()) {
    return null;
  }
  return previousCronTime(schedule, now);
}

/**
 * Evaluate pending state given tag and branch backup timestamps.
 * Exported for unit tests.
 */
export function checkBackupPendingState(
  tenant,
  now,
  latestTagBackup,
  latestBranchBackup = null
) {
  const schedule = tenant.schedule || "0 0 * * *";
  const scheduledTime = getCurrentWindowScheduledTime(schedule, now);

  if (!scheduledTime) {
    return { pending: false, reason: "before-window" };
  }

  if (latestTagBackup && latestTagBackup.getTime() >= scheduledTime.getTime()) {
    return { pending: false, reason: "up-to-date" };
  }

  if (latestBranchBackup && latestBranchBackup.getTime() >= scheduledTime.getTime()) {
    return { pending: true, reason: "missing-tag" };
  }

  if (!latestTagBackup && !latestBranchBackup) {
    return { pending: true, reason: "pending" };
  }

  return { pending: true, reason: "pending" };
}

/**
 * Check if a tenant's backup is pending.
 */
function isBackupPending(tenant, now) {
  const tagMap = getLatestTagMap();
  const tagTime = getLatestTagBackupTime(tenant.name, tagMap);
  const branchTime = getLatestBranchBackupTime(tenant.name);
  return checkBackupPendingState(tenant, now, tagTime, branchTime);
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    activeOnly: !args.includes("--all"),
    countOnly: args.includes("--count"),
    checkSchedule: args.includes("--check-schedule"),
    checkPending: args.includes("--check-pending"),
    tenantFilter: args.includes("--tenant") ? args[args.indexOf("--tenant") + 1] : null,
  };
}

function main() {
  const { activeOnly, countOnly, checkSchedule, checkPending, tenantFilter } = parseArgs();
  const registry = loadRegistry();

  let tenants = registry.tenants;
  if (tenantFilter) {
    tenants = tenants.filter((t) => t.name === tenantFilter);
  }

  if (activeOnly) {
    tenants = tenants.filter((t) => t.active === true);
  }

  if (checkSchedule) {
    const now = new Date();
    tenants = tenants.filter((t) => {
      const scheduleExpr = t.schedule || "0 0 * * *";
      return isWithinScheduleWindow(scheduleExpr, now);
    });
  }

  if (checkPending) {
    const now = new Date();
    preloadBranchBackupTimes(tenants);
    tenants = tenants.map((t) => {
      const { pending, reason } = isBackupPending(t, now);
      return { ...t, pending, reason };
    }).filter((t) => t.pending);
  }

  if (countOnly) {
    console.log(tenants.length);
    process.exit(0);
  }

  // Name is the single source of truth — branch and environment are identical
  const matrix = {
    include: tenants.map((t) => ({
      tenant: t.name,
      branch: t.name,
      environment: t.name,
      schedule: t.schedule || "0 0 * * *",
      hostname: t.hostname || "",
      reason: t.reason || "",
      exportPollMinutes: resolveExportPollMinutes(t),
      jobTimeoutMinutes: resolveJobTimeoutMinutes(t),
    })),
  };

  console.log(JSON.stringify(matrix));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}




