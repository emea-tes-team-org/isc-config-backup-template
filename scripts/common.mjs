// ---------------------------------------------------------------------------
// Shared configuration and helpers for backup/restore scripts
// ---------------------------------------------------------------------------

export const TENANT_URL = requiredEnv("TENANT_URL").replace(/\/+$/, "");
if (!TENANT_URL.startsWith("https://")) {
  console.error("ERROR: TENANT_URL must use HTTPS to prevent man-in-the-middle attacks.");
  process.exit(1);
}
export const CLIENT_ID = requiredEnv("CLIENT_ID");
export const CLIENT_SECRET = requiredEnv("CLIENT_SECRET");

export const API_VERSION = "v2025";
export const MAX_RETRIES = 3;

// Extract tenant name from URL (e.g. "https://beta-15156.api.identitynow-demo.com" → "beta-15156")
// If TENANT_NAME is provided in the environment, use it instead (useful when tenant name != URL hostname).
export const TENANT_NAME = process.env.TENANT_NAME || new URL(TENANT_URL).hostname.split(".")[0];

let accessToken = "";
let overrideTenantUrl = "";

/**
 * Override the target tenant URL for cross-tenant restores.
 * When set, authenticate() and apiCall() use this instead of TENANT_URL.
 */
export function setTenantUrl(url) {
  overrideTenantUrl = url.replace(/\/+$/, "");
}

function getEffectiveTenantUrl() {
  return overrideTenantUrl || TENANT_URL;
}

import { execFileSync } from "child_process";

/**
 * Read .tenant.yaml from a given git branch and return the URL.
 * Tries both the local branch and the remote tracking ref (origin/<branch>)
 * so it works in GitHub Actions where only the remote ref exists.
 */
export function resolveTenantUrl(tenantName) {
  const refs = [
    `${tenantName}:.tenant.yaml`,
    `origin/${tenantName}:.tenant.yaml`,
  ];
  for (const ref of refs) {
    try {
      const raw = execFileSync("git", ["show", ref], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      const match = raw.match(/^url:\s*"?(.+?)"?\s*$/m);
      if (match) return match[1].trim().replace(/\/+$/, "");
    } catch {
      // try next ref
    }
  }
  throw new Error(
    `Could not resolve URL for tenant "${tenantName}". ` +
      `Tried local branch "${tenantName}" and remote "origin/${tenantName}". ` +
      `Ensure the branch exists and contains a .tenant.yaml file with a url field.`
  );
}

export function requiredEnv(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`ERROR: Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return val;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make an authenticated API call with retry logic for 429/5xx errors.
 */
export async function apiCall(method, path, body = undefined) {
  const url = `${getEffectiveTenantUrl()}${path}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    };
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (res.ok) {
      if (res.status === 204) return null;
      const text = await res.text();
      if (!text) return null;
      return JSON.parse(text);
    }

    if (res.status === 429 || res.status >= 500) {
      const wait = attempt * 5_000;
      console.warn(
        `  Retry ${attempt}/${MAX_RETRIES}: HTTP ${res.status} on ${method} ${path} — waiting ${wait / 1000}s`
      );
      await sleep(wait);
      continue;
    }

    const errBody = await res.text().catch(() => "");
    throw new Error(
      `API error: HTTP ${res.status} on ${method} ${path}\n${errBody}`
    );
  }

  throw new Error(
    `API call failed after ${MAX_RETRIES} retries: ${method} ${path}`
  );
}

/**
 * Authenticate with SailPoint using OAuth client credentials.
 */
export async function authenticate() {
  console.log("Authenticating...");

  const res = await fetch(`${getEffectiveTenantUrl()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Authentication failed: HTTP ${res.status}\n${errBody}`);
  }

  const data = await res.json();
  accessToken = data.access_token;

  if (!accessToken) {
    throw new Error("Authentication response missing access_token");
  }

  console.log("Authenticated successfully");
}

/**
 * Get the current access token (must call authenticate() first).
 */
export function getAccessToken() {
  return accessToken;
}
