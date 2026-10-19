#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Copy ISC credentials from the current job environment into the tenant-named
// GitHub Environment, then remove legacy environment overrides from tenants.yaml.
//
// Run inside a workflow job that references the legacy environment so
// TENANT_URL / CLIENT_ID / CLIENT_SECRET are available in process.env.
//
// Usage: node scripts/sync-tenant-secrets.mjs <tenant-name>
// ---------------------------------------------------------------------------

import sodium from "libsodium-wrappers";
import { loadRegistry, saveRegistry, getTenant } from "./tenant-registry.mjs";
import { getPat } from "./onboard-utils.mjs";

const GITHUB_API = "https://api.github.com";
const SECRET_NAMES = ["TENANT_URL", "CLIENT_ID", "CLIENT_SECRET"];

async function githubApi(path, opts = {}) {
  const pat = getPat();
  if (!pat) {
    throw new Error("ADMIN_TOKEN or GH_TOKEN is required to sync environment secrets");
  }

  const res = await fetch(`${GITHUB_API}${path}`, {
    ...opts,
    headers: {
      Authorization: `token ${pat}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}\n${JSON.stringify(data, null, 2)}`);
  }

  return data;
}

function resolveRepo() {
  if (process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
    if (owner && repo) return { owner, repo };
  }
  throw new Error("GITHUB_REPOSITORY is required");
}

async function ensureEnvironment(owner, repo, environment) {
  try {
    await githubApi(`/repos/${owner}/${repo}/environments/${environment}`, {
      method: "PUT",
      body: JSON.stringify({}),
    });
  } catch (err) {
    const message = err.message || "";
    if (!message.includes("422") && !message.includes("already exists")) {
      throw err;
    }
  }
}

async function setEnvironmentSecret(owner, repo, environment, secretName, secretValue) {
  const { key_id: keyId, key: publicKey } = await githubApi(
    `/repos/${owner}/${repo}/environments/${environment}/secrets/public-key`
  );

  await sodium.ready;
  const binKey = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
  const binSec = sodium.from_string(secretValue);
  const encryptedBytes = sodium.crypto_box_seal(binSec, binKey);
  const encryptedValue = sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);

  await githubApi(`/repos/${owner}/${repo}/environments/${environment}/secrets/${secretName}`, {
    method: "PUT",
    body: JSON.stringify({
      encrypted_value: encryptedValue,
      key_id: keyId,
    }),
  });
}

export async function syncTenantSecrets(tenantName, options = {}) {
  const registry = options.registry ?? loadRegistry();
  const tenant = getTenant(registry, tenantName);
  if (!tenant) {
    throw new Error(`Tenant "${tenantName}" not found in tenants.yaml`);
  }

  const missing = SECRET_NAMES.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const { owner, repo } = resolveRepo();
  await ensureEnvironment(owner, repo, tenantName);

  await Promise.all(
    SECRET_NAMES.map(async (secretName) => {
      await setEnvironmentSecret(owner, repo, tenantName, secretName, process.env[secretName]);
      console.log(`Set ${secretName} on environment ${tenantName}`);
    })
  );

  if (tenant.environment && tenant.environment !== tenantName) {
    delete tenant.environment;
    saveRegistry(registry, options.registryFile);
    console.log(`Removed legacy environment override for ${tenantName} from tenants.yaml`);
  }

  return { tenant: tenantName, environment: tenantName };
}

const isMain =
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], "file:").href;

if (isMain) {
  const tenantName = process.argv[2];
  if (!tenantName) {
    console.error("Usage: node scripts/sync-tenant-secrets.mjs <tenant-name>");
    process.exit(1);
  }

  syncTenantSecrets(tenantName)
    .then((result) => {
      console.log(`Synced secrets for ${result.tenant}`);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
