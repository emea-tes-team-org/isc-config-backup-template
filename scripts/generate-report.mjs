#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Generate the daily ISC backup summary report in markdown.
//
// Usage: node scripts/generate-report.mjs [--results <json>] [--registry <path>] [--now <iso>] > report.md
//
// The script reads tenant metadata from tenants.yaml (via tenant-registry.mjs),
// uses the per-tenant backup results JSON emitted by the matrix job, and
// emits a markdown report with per-tenant status, schedule, hostname, and
// next backup time. Core logic is exported for testing.
// ---------------------------------------------------------------------------

import { resolve } from "path";
import { fileURLToPath } from "url";
import { loadRegistry, getTenant } from "./tenant-registry.mjs";
import { nextCronTime } from "./cron-utils.mjs";

const DEFAULT_REGISTRY_FILE = "tenants.yaml";

function parseArgs(args) {
  const result = {
    resultsJson: null,
    registryFile: DEFAULT_REGISTRY_FILE,
    now: new Date(),
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--results") {
      result.resultsJson = args[++i];
    } else if (arg === "--registry") {
      result.registryFile = args[++i];
    } else if (arg === "--now") {
      result.now = new Date(args[++i]);
    }
  }
  return result;
}

/**
 * Normalize backup results JSON. Accepts a JSON array of result objects, a single
 * result object, or (legacy) an object keyed by matrix index whose values are
 * JSON strings. Returns an array of result objects.
 */
export function normalizeResults(resultsJson) {
  if (!resultsJson) return [];
  const parsed = JSON.parse(resultsJson);
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object") {
    return Object.values(parsed).map((entry) =>
      typeof entry === "string" ? JSON.parse(entry) : entry
    );
  }
  return [];
}

/**
 * Build a tenant → attempt-status map from matrix backup results JSON.
 */
export function loadAttemptStatusesFromResults(resultsJson) {
  const statuses = {};
  for (const result of normalizeResults(resultsJson)) {
    if (result?.tenant && result?.status) {
      statuses[result.tenant] = result.status;
    }
  }
  return statuses;
}

/**
 * Parse tenant attempt statuses from a committed backup summary report.
 */
export function parseAttemptStatusesFromReport(markdown) {
  const statuses = {};
  if (!markdown) return statuses;

  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|") || line.includes("|--------|") || line.includes("| Tenant |")) {
      continue;
    }
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length < 3) continue;
    const tenant = cells[1];
    const status = cells[2];
    if (tenant && status) {
      statuses[tenant] = status;
    }
  }
  return statuses;
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|");
}

function formatNextBackup(schedule, now) {
  if (!schedule || schedule === "daily") return "daily";
  const next = nextCronTime(schedule, now);
  if (!next) return "—";
  const yyyy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  const hh = String(next.getUTCHours()).padStart(2, "0");
  const mi = String(next.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
}

/**
 * Resolve the effective schedule for "Next Backup" computation.
 * Prefer the registry entry; fall back to a cron expression from the result
 * when the tenant is unknown to the registry (e.g. tenant removed from
 * tenants.yaml but still backed up).
 */
function effectiveSchedule(tenantMeta, result) {
  if (tenantMeta.schedule) return tenantMeta.schedule;
  if (result.schedule && result.schedule !== "daily") return result.schedule;
  return "daily";
}



function renderResultRow(result, registry, now) {
  const tenantMeta = getTenant(registry, result.tenant) || {};
  const hostname = tenantMeta.hostname || "—";
  const schedule = result.schedule || tenantMeta.schedule || "daily";
  const tag = result.tag || "-";
  const size = result.size ?? 0;
  const files = result.files ?? 0;
  const added = result.added ?? 0;
  const deleted = result.deleted ?? 0;
  const modified = result.modified ?? 0;
  const nextBackup = formatNextBackup(effectiveSchedule(tenantMeta, result), now);

  return `| ${escapeCell(result.tenant)} | ${escapeCell(result.status)} | ${escapeCell(schedule)} | ${escapeCell(nextBackup)} | ${escapeCell(hostname)} | ${escapeCell(tag)} | ${size} | ${files} | +${added} | -${deleted} | ~${modified} |`;
}

function renderSynthesizedRow(tenant, status, now) {
  const hostname = tenant.hostname || "—";
  const schedule = tenant.schedule || "daily";
  const nextBackup =
    tenant.active === false ? "—" : formatNextBackup(tenant.schedule, now);

  return `| ${escapeCell(tenant.name)} | ${escapeCell(status)} | ${escapeCell(schedule)} | ${escapeCell(nextBackup)} | ${escapeCell(hostname)} | - | - | - | - | - | - |`;
}

/**
 * Build the markdown report.
 *
 * @param {string} resultsJson - JSON string from the matrix job's `result` output
 * @param {object} registry - parsed tenant registry (from tenant-registry.mjs)
 * @param {Date} now - reference time used for "next backup" and the report header
 * @param {object} options - optional inputs:
 *   - allActiveJson: JSON matrix of all active tenants (for skipped/up-to-date detection)
 *   - scheduleMatchJson: JSON matrix of tenants whose schedule matched
 *   - scheduledCount: number of tenants the matrix actually ran
 */
export function generateReport(resultsJson, registry, now, options = {}) {
  const lines = [];
  const date = now.toISOString().slice(0, 10);
  const results = normalizeResults(resultsJson);

  lines.push(`## 🔄 ISC Backup Report — ${date}`);
  lines.push("");
  lines.push("| Tenant | Status | Schedule | Next Backup | Hostname | Tag | Size (B) | Files | Added | Deleted | Modified |");
  lines.push("|--------|--------|----------|-------------|----------|-----|----------|-------|-------|---------|----------|");

  const ranNames = new Set(results.map((r) => r.tenant));

  for (const result of results) {
    lines.push(renderResultRow(result, registry, now));
  }

  // Up-to-date tenants: schedule matched but no matrix entry ran them
  if (options.scheduleMatchJson && options.allActiveJson) {
    const matched = JSON.parse(options.scheduleMatchJson).include || [];
    const allActive = JSON.parse(options.allActiveJson).include || [];
    const upToDate = matched.filter((t) => !ranNames.has(t.tenant));
    for (const tenant of upToDate) {
      const tenantMeta = getTenant(registry, tenant.tenant) || {};
      lines.push(renderSynthesizedRow({ ...tenantMeta, schedule: tenant.schedule }, "up-to-date", now));
    }

    // Skipped tenants: active but schedule did not match
    const matchedNames = new Set(matched.map((m) => m.tenant));
    // ⚡ Bolt: Replace O(N^2) some() inside filter() with O(N) Set lookup
    // Impact: Prevents quadratic scaling when reporting on hundreds of skipped tenants.
    const skipped = allActive.filter(
      (t) => !matchedNames.has(t.tenant) && !ranNames.has(t.tenant)
    );
    for (const tenant of skipped) {
      const tenantMeta = getTenant(registry, tenant.tenant) || {};
      lines.push(renderSynthesizedRow({ ...tenantMeta, schedule: tenant.schedule }, "skipped", now));
    }
  }

  lines.push("");
  lines.push(`**Total tenants processed:** ${results.length || options.scheduledCount || 0}`);
  lines.push(`**Total active tenants:** ${(JSON.parse(options.allActiveJson || "{\"include\":[]}").include || []).length}`);

  return lines.join("\n");
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const registry = loadRegistry(args.registryFile);
  process.stdout.write(generateReport(args.resultsJson, registry, args.now));
}


