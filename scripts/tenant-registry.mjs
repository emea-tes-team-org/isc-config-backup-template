// ---------------------------------------------------------------------------
// Shared tenant registry parser.
//
// Reads tenants.yaml and returns a structured registry object. This module
// has no CLI side effects and can be imported by any script.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from "fs";

export const DEFAULT_REGISTRY_FILE = "tenants.yaml";
const DEFAULT_SCHEDULE = "0 0 * * *";
export const DEFAULT_EXPORT_POLL_MINUTES = 10;
export const DEFAULT_JOB_TIMEOUT_MINUTES = 15;

export function loadRegistry(registryFile = DEFAULT_REGISTRY_FILE) {
  if (!existsSync(registryFile)) {
    return { tenants: [] };
  }
  try {
    const content = readFileSync(registryFile, "utf-8");
    const lines = content.split("\n");
    const registry = { tenants: [] };
    let currentTenant = null;
    let inTenants = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "tenants:") {
        inTenants = true;
        continue;
      }
      if (!inTenants) continue;

      if (trimmed.startsWith("- name:")) {
        if (currentTenant) registry.tenants.push(currentTenant);
        currentTenant = { name: trimmed.replace("- name:", "").trim() };
      } else if (currentTenant && trimmed.includes(":")) {
        const [key, ...valueParts] = trimmed.split(":");
        const value = valueParts.join(":").trim();
        const cleanValue = value.replace(/^"(.+)"$/, "$1");
        if (key === "active") {
          currentTenant[key] = cleanValue === "true";
        } else if (key === "exportPollMinutes" || key === "jobTimeoutMinutes") {
          currentTenant[key] = parseInt(cleanValue, 10);
        } else {
          currentTenant[key] = cleanValue;
        }
      }
    }
    if (currentTenant) registry.tenants.push(currentTenant);
    return registry;
  } catch (err) {
    console.error(`Error: could not parse ${registryFile}: ${err.message}`);
    process.exit(1);
  }
}

// ⚡ Bolt: Implement in-memory registry cache to avoid O(N) array search per tenant
// Impact: Reduces complexity of getTenant from O(N) to O(1) via Map lookup.
const tenantLookupCache = new WeakMap();

export function getTenant(registry, name) {
  if (!registry || !registry.tenants) return undefined;

  let cacheInfo = tenantLookupCache.get(registry);

  // Invalidate cache if array length changed (simple heuristic for mutations like push/splice)
  if (!cacheInfo || cacheInfo.length !== registry.tenants.length) {
    cacheInfo = {
      length: registry.tenants.length,
      map: new Map(registry.tenants.map((t) => [t.name, t]))
    };
    tenantLookupCache.set(registry, cacheInfo);
  }
  return cacheInfo.map.get(name);
}

export function resolveExportPollMinutes(tenant) {
  const value = tenant?.exportPollMinutes;
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_EXPORT_POLL_MINUTES;
}

export function resolveJobTimeoutMinutes(tenant) {
  const value = tenant?.jobTimeoutMinutes;
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_JOB_TIMEOUT_MINUTES;
}

export function getTenantBackupSettings(registry, tenantName) {
  const tenant = getTenant(registry, tenantName);
  return {
    exportPollMinutes: resolveExportPollMinutes(tenant),
    jobTimeoutMinutes: resolveJobTimeoutMinutes(tenant),
  };
}

export function saveRegistry(registry, registryFile = DEFAULT_REGISTRY_FILE) {
  const lines = [
    "# Tenant registry — lightweight index of all onboarded tenants.",
    "# Name is the single source of truth: it determines both branch and environment.",
    "# Optional description may be included for display purposes.",
    "# Optional schedule uses standard 5-field cron (minute hour day-of-month month day-of-week).",
    "#   Missing schedule means the tenant runs at the default time (daily at 00:00 UTC).",
    "# Optional hostname is a display reference only; the authoritative URL lives in",
    "# .tenant.yaml on each tenant branch.",
    "# Optional exportPollMinutes / jobTimeoutMinutes tune ISC export poll budget and",
    "# GitHub Actions job timeout for large tenants (defaults: 10 / 15).",
    "# Full metadata (description, active, url) lives in .tenant.yaml on each branch.",
    "tenants:",
  ];
  for (const t of registry.tenants) {
    lines.push("");
    lines.push(`  - name: ${t.name}`);
    if (t.active !== undefined) lines.push(`    active: ${t.active}`);
    if (t.environment !== undefined && t.environment !== "") {
      lines.push(`    environment: ${t.environment}`);
    }
    if (t.schedule !== undefined && t.schedule !== "") {
      lines.push(`    schedule: "${t.schedule}"`);
    }
    if (t.hostname !== undefined && t.hostname !== "") {
      lines.push(`    hostname: ${t.hostname}`);
    }
    if (t.description !== undefined && t.description !== "") {
      lines.push(`    description: "${t.description.replace(/"/g, '\\"')}"`);
    }
    if (t.exportPollMinutes !== undefined) {
      lines.push(`    exportPollMinutes: ${t.exportPollMinutes}`);
    }
    if (t.jobTimeoutMinutes !== undefined) {
      lines.push(`    jobTimeoutMinutes: ${t.jobTimeoutMinutes}`);
    }
  }
  lines.push("");
  writeFileSync(registryFile, lines.join("\n"));
}

/**
 * Flip a tenant's active flag. When re-enabling without a schedule, assigns the default.
 * @returns {{ ok: true, tenant: object, newActive: boolean } | { ok: false, error: string }}
 */
export function toggleTenantActive(registry, tenantName) {
  const tenant = getTenant(registry, tenantName);
  if (!tenant) {
    return { ok: false, error: `Tenant "${tenantName}" not found` };
  }
  const newActive = !tenant.active;
  tenant.active = newActive;
  if (newActive && !tenant.schedule) {
    tenant.schedule = DEFAULT_SCHEDULE;
  }
  return { ok: true, tenant, newActive };
}

/**
 * Remove a tenant from the in-memory registry.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function removeTenantFromRegistry(registry, tenantName) {
  const index = registry.tenants.findIndex((t) => t.name === tenantName);
  if (index === -1) {
    return { ok: false, error: `Tenant "${tenantName}" not found` };
  }
  registry.tenants.splice(index, 1);
  return { ok: true };
}

/** Whether a tenant name appears in the registry (restore target validation). */
export function isRegisteredTenant(registry, tenantName) {
  return registry.tenants.some((t) => t.name === tenantName);
}


