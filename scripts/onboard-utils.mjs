import { readFileSync, existsSync } from "fs";
import { join } from "path";

const PAT_FILE = join(".github", ".local-pat");

export function getPat() {
  const envToken =
    process.env.GH_TOKEN || process.env.ADMIN_TOKEN || process.env.GITHUB_TOKEN;
  if (envToken) return envToken;

  if (!existsSync(PAT_FILE)) return null;
  try {
    const data = JSON.parse(readFileSync(PAT_FILE, "utf-8"));
    return data.pat;
  } catch {
    return null;
  }
}

export function computeOnboardOutcome({ registryExisted, branchExisted }) {
  if (!registryExisted && !branchExisted) {
    return { created: true, updated: false, action: "created" };
  }
  return { created: false, updated: true, action: "updated" };
}

export function mergeTenantRegistryEntry(registry, name, url, active, description) {
  const existingIndex = registry.tenants.findIndex((t) => t.name === name);
  const existingTenant = existingIndex !== -1 ? registry.tenants[existingIndex] : {};

  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = existingTenant.hostname || "";
  }

  let schedule = existingTenant.schedule || "";
  if (active && !schedule) {
    schedule = "0 0 * * *";
  }

  const tenantEntry = {
    name,
    active,
    ...(schedule ? { schedule } : {}),
    ...(hostname ? { hostname } : {}),
    ...(description ? { description } : {}),
  };

  if (existingIndex !== -1) {
    registry.tenants[existingIndex] = { ...registry.tenants[existingIndex], ...tenantEntry };
  } else {
    registry.tenants.push(tenantEntry);
  }

  return {
    registry,
    registryExisted: existingIndex !== -1,
    entry: existingIndex !== -1 ? registry.tenants[existingIndex] : tenantEntry,
  };
}
