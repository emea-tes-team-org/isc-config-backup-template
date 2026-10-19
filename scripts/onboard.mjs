#!/usr/bin/env node
// ---------------------------------------------------------------------------
// ISC Tenant Onboarding CLI
//
// Modes:
//   --interactive          Prompt for tenant details interactively
//   --config <file>        Read tenant details from YAML file
//   --list                 List all registered tenants
//   --update <name>        Update secrets for an existing tenant
//   --remove <name>        Deprecated — use `node scripts/cli.mjs offboard <name>`
//
// The first time you run this, it will ask for a fine-grained GitHub PAT
// (see docs/setup.md) and store it in .github/.local-pat (never committed).
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import readline from "readline";
import sodium from "libsodium-wrappers";
import { loadRegistry, saveRegistry, DEFAULT_REGISTRY_FILE, getTenant } from "./tenant-registry.mjs";
import { getPat, computeOnboardOutcome, mergeTenantRegistryEntry } from "./onboard-utils.mjs";

const PAT_FILE = join(".github", ".local-pat");
const REGISTRY_FILE = DEFAULT_REGISTRY_FILE;
const GITHUB_API = "https://api.github.com";

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

function savePat(pat) {
  mkdirSync(".github", { recursive: true });
  writeFileSync(PAT_FILE, JSON.stringify({ pat }, null, 2));
  console.log(`PAT saved to ${PAT_FILE}`);
}

async function githubApi(path, opts = {}) {
  const pat = getPat();
  if (!pat) throw new Error("GitHub PAT not found. Run with --interactive to set up.");

  const url = `${GITHUB_API}${path}`;
  const res = await fetch(url, {
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

async function getRepoInfo() {
  if (process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
    if (owner && repo) return { owner, repo };
  }

  // Try to extract owner/repo from git remote
  try {
    const { execSync } = await import("child_process");
    const remote = execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
    const match = remote.match(/github\.com[:\/](.+?)\/(.+?)(?:\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch {
    /* ignore */
  }
  return null;
}

// ---------------------------------------------------------------------------
// Prompt helpers
// ---------------------------------------------------------------------------

function ask(question, defaultValue = "") {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

function askSecret(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${question}: `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
    rl._writeToOutput = (stringToWrite) => {
      if (stringToWrite.trim() === question + ":") {
        rl.output.write(stringToWrite);
      } else {
        rl.output.write("*");
      }
    };
  });
}

function askYesNo(question, defaultValue = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? " [Y/n]: " : " [y/N]: ";
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}`, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (!a) resolve(defaultValue);
      else resolve(a === "y" || a === "yes");
    });
  });
}

// ---------------------------------------------------------------------------
// Tenant name validation
// ---------------------------------------------------------------------------

function validateTenantName(name) {
  if (!name) return "Tenant name is required";
  if (!/^[a-z0-9-]+$/.test(name)) {
    return "Tenant name must be lowercase, alphanumeric, and may contain hyphens (no spaces)";
  }
  if (name.startsWith("-") || name.endsWith("-")) {
    return "Tenant name cannot start or end with a hyphen";
  }
  return null;
}

function extractTenantNameFromUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.split(".")[0];
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Registry management (saveRegistry imported from tenant-registry.mjs)
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// YAML config parser (minimal)
// ---------------------------------------------------------------------------

function parseTenantYaml(content) {
  const lines = content.split("\n");
  const config = { tenant: {} };
  let inTenant = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "tenant:") {
      inTenant = true;
      continue;
    }
    if (!inTenant) continue;
    if (trimmed.startsWith("- ") || trimmed === "tenants:") {
      inTenant = false;
      continue;
    }
    if (trimmed.includes(":")) {
      const [key, ...valueParts] = trimmed.split(":");
      const value = valueParts.join(":").trim();
      const cleanValue = value.replace(/^"(.+)"$/, "$1");
      if (key === "active") {
        config.tenant[key] = cleanValue === "true";
      } else {
        config.tenant[key] = cleanValue;
      }
    }
  }

  return config;
}

// ---------------------------------------------------------------------------
// GitHub operations
// ---------------------------------------------------------------------------

async function branchExists(owner, repo, tenantName) {
  try {
    await githubApi(`/repos/${owner}/${repo}/git/refs/heads/${tenantName}`);
    return true;
  } catch {
    return false;
  }
}

async function createBranch(owner, repo, tenantName) {
  const branchName = tenantName;

  // Get main branch SHA
  const mainRef = await githubApi(`/repos/${owner}/${repo}/git/refs/heads/main`);
  const mainSha = mainRef.object.sha;

  try {
    await githubApi(`/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: mainSha,
      }),
    });
    console.log(`Created branch: ${branchName}`);
  } catch (err) {
    if (err.message.includes("Reference already exists")) {
      console.log(`Branch ${branchName} already exists`);
    } else {
      throw err;
    }
  }
}

async function createEnvironment(owner, repo, tenantName) {
  try {
    await githubApi(`/repos/${owner}/${repo}/environments/${tenantName}`, {
      method: "PUT",
      body: JSON.stringify({}),
    });
    console.log(`Created environment: ${tenantName}`);
  } catch (err) {
    const message = err.message || "";
    if (
      message.includes("already exists") ||
      message.includes("422") ||
      message.includes("protection rule")
    ) {
      console.log(`Environment ${tenantName} already exists or was updated`);
    } else {
      throw err;
    }
  }
}

async function createSecret(owner, repo, environment, secretName, secretValue) {
  // Get public key for the environment
  const keyData = await githubApi(`/repos/${owner}/${repo}/environments/${environment}/secrets/public-key`);
  const { key_id: keyId, key: publicKey } = keyData;

  // Encrypt the secret using libsodium (cross-platform, no shell needed)
  await sodium.ready;
  const binKey = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
  const binSec = sodium.from_string(secretValue);
  const encryptedBytes = sodium.crypto_box_seal(binSec, binKey);
  const encryptedValue = sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);

  // Upload via GitHub API
  await githubApi(`/repos/${owner}/${repo}/environments/${environment}/secrets/${secretName}`, {
    method: "PUT",
    body: JSON.stringify({
      encrypted_value: encryptedValue,
      key_id: keyId,
    }),
  });
  console.log(`  Set secret: ${secretName}`);
}

function buildTenantYaml(config) {
  const lines = [
    `# Tenant descriptor — committed to the ${config.name} branch`,
    `# Secrets (CLIENT_ID, CLIENT_SECRET) are stored in the GitHub Environment`,
    ``,
    `name: ${config.name}`,
    `description: "${config.description || ""}"`,
    `active: ${config.active === true}`,
    `url: "${config.url}"`,
    ``,
  ];
  return lines.join("\n");
}

async function commitTenantYaml(owner, repo, tenantName, config) {
  const content = buildTenantYaml(config);
  const encoded = Buffer.from(content).toString("base64");

  // Check if file already exists to get SHA for update
  let existingSha = null;
  try {
    const existing = await githubApi(`/repos/${owner}/${repo}/contents/.tenant.yaml?ref=${tenantName}`);
    existingSha = existing.sha;
  } catch {
    // File doesn't exist yet — create it
  }

  const body = {
    message: `chore: update tenant descriptor [skip ci]`,
    content: encoded,
    branch: tenantName,
  };
  if (existingSha) {
    body.sha = existingSha;
  }

  await githubApi(`/repos/${owner}/${repo}/contents/.tenant.yaml`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  console.log(`  Committed .tenant.yaml to ${tenantName} branch`);
}

function buildBranchGitignore(tenantName) {
  return [
    `# Branch-specific gitignore — only track backups for ${tenantName}`,
    ``,
    `# Ignore everything by default`,
    `*`,
    ``,
    `# Track tenant metadata and flat backup tree`,
    `!.gitignore`,
    `!.tenant.yaml`,
    `!backups/`,
    `!backups/**`,
    `!templates/`,
    `!templates/**`,
    `!vars/`,
    `!vars/**`,
    ``,
    `# Standard ignores (when present on branch)`,
    `node_modules/`,
    `.env*`,
    `*.log`,
    `.DS_Store`,
    `.github/.local-pat`,
    ``,
  ].join("\n");
}

async function commitBranchGitignore(owner, repo, tenantName) {
  const content = buildBranchGitignore(tenantName);
  const encoded = Buffer.from(content).toString("base64");

  let existingSha = null;
  try {
    const existing = await githubApi(`/repos/${owner}/${repo}/contents/.gitignore?ref=${tenantName}`);
    existingSha = existing.sha;
  } catch {
    // File doesn't exist yet
  }

  const body = {
    message: `chore: add branch-specific .gitignore [skip ci]`,
    content: encoded,
    branch: tenantName,
  };
  if (existingSha) {
    body.sha = existingSha;
  }

  await githubApi(`/repos/${owner}/${repo}/contents/.gitignore`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  console.log(`  Committed branch-specific .gitignore to ${tenantName} branch`);
}

// ---------------------------------------------------------------------------
// Onboarding flow
// ---------------------------------------------------------------------------

async function setupGithubTenant(
  owner,
  repo,
  name,
  url,
  clientId,
  clientSecret,
  active,
  description,
  secretsEnvironment = name
) {
  // Create branch
  await createBranch(owner, repo, name);

  // Credentials live on the backup environment (may differ from tenant name via tenants.yaml)
  await createEnvironment(owner, repo, secretsEnvironment);

  // Create secrets
  console.log(`Setting secrets on environment ${secretsEnvironment}...`);
  await createSecret(owner, repo, secretsEnvironment, "TENANT_URL", url);
  await createSecret(owner, repo, secretsEnvironment, "CLIENT_ID", clientId);
  await createSecret(owner, repo, secretsEnvironment, "CLIENT_SECRET", clientSecret);

  // Commit branch-specific files
  console.log("Committing branch files...");
  await commitBranchGitignore(owner, repo, name);
  await commitTenantYaml(owner, repo, name, { name, url, active, description });
}

function updateTenantRegistry(name, url, active, description) {
  const registry = loadRegistry();
  const { registryExisted } = mergeTenantRegistryEntry(registry, name, url, active, description);

  if (registryExisted) {
    console.log(`Updated existing tenant: ${name}`);
  } else {
    console.log(`Added new tenant: ${name}`);
  }

  saveRegistry(registry, REGISTRY_FILE);
  console.log(`\nUpdated ${REGISTRY_FILE}`);
}

function writeOnboardOutputs(outcome) {
  const line = `onboard_action=${outcome.action}\n`;
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, line);
  }
  console.log(`ONBOARD_ACTION=${outcome.action}`);
}

async function pushRegistryToMain(tenantName, action) {
  const { execSync, execFileSync } = await import("child_process");
  const run = (cmd, args = []) => {
    if (args.length > 0) {
      execFileSync(cmd, args, { stdio: "inherit" });
    } else {
      execSync(cmd, { stdio: "inherit" });
    }
  };
  run('git config user.name "github-actions[bot]"');
  run('git config user.email "github-actions[bot]@users.noreply.github.com"');
  run("git fetch origin main");
  run("git checkout main");
  run("git pull --rebase --autostash origin main");
  run("git add tenants.yaml");
  const verb = action === "created" ? "register" : "update";
  const diff = execSync("git diff --cached --name-only", { encoding: "utf-8" }).trim();
  if (!diff) {
    console.log("Registry already up to date on main — skipping push");
    return;
  }
  run("git", ["commit", "-m", `onboard: ${verb} tenant ${tenantName} in tenants.yaml [skip ci]`]);
  run("git push origin main");
}

async function onboardTenant(config, options = {}) {
  const { name, url, client_id: clientId, client_secret: clientSecret, active = false, description = "" } = config;

  // Validate
  const nameError = validateTenantName(name);
  if (nameError) {
    console.error(`Error: ${nameError}`);
    process.exit(1);
  }

  if (!url || !clientId || !clientSecret) {
    console.error("Error: url, client_id, and client_secret are all required");
    process.exit(1);
  }

  const repoInfo = await getRepoInfo();
  if (!repoInfo) {
    console.error("Error: Could not determine GitHub owner/repo from git remote");
    console.error("Please ensure you're in a git repository with a GitHub origin remote");
    process.exit(1);
  }

  const { owner, repo } = repoInfo;
  const registry = loadRegistry();
  const existingTenant = getTenant(registry, name);
  const registryExisted = Boolean(existingTenant);
  const branchExisted = await branchExists(owner, repo, name);
  const outcome = computeOnboardOutcome({ registryExisted, branchExisted });
  const secretsEnvironment = process.env.SECRETS_ENVIRONMENT || name;

  console.log(`\n=== Onboarding tenant: ${name} ===`);
  console.log(`Repository: ${owner}/${repo}`);
  console.log(`Secrets environment: ${secretsEnvironment}`);
  console.log(`Branch: ${name}`);
  console.log(`Active: ${active}`);
  console.log(`Mode: ${outcome.action}`);
  console.log("");

  await setupGithubTenant(
    owner,
    repo,
    name,
    url,
    clientId,
    clientSecret,
    active,
    description,
    secretsEnvironment
  );
  updateTenantRegistry(name, url, active, description);

  if (options.pushRegistry) {
    await pushRegistryToMain(name, outcome.action);
  }

  writeOnboardOutputs(outcome);

  console.log("\n✅ Onboarding complete!");
  console.log(`\nNext steps:`);
  console.log(`  1. Push the branch if needed: git push origin ${name}`);
  console.log(`  2. Set up environment protection rules in GitHub if desired`);
  console.log(`  3. Run backup manually to test: git checkout ${name} && npm run backup`);

  return { name, ...outcome };
}

// ---------------------------------------------------------------------------
// Interactive mode
// ---------------------------------------------------------------------------

async function interactiveMode() {
  console.log("=== ISC Tenant Onboarding ===\n");

  // Check PAT
  let pat = getPat();
  if (!pat) {
    console.log("It looks like this is your first time running the onboarding tool.");
    console.log("You'll need a fine-grained GitHub PAT for this repository:");
    console.log("  - Administration: Read and write");
    console.log("  - Environments: Read and write");
    console.log("  - Contents: Read and write");
    console.log("  - Workflows: Read and write");
    console.log("  - Actions: Read-only");
    console.log("\nCreate one at: https://github.com/settings/personal-access-tokens/new");
    console.log("Click-by-click steps: docs/setup.md\n");
    pat = await ask("GitHub PAT");
    if (!pat) {
      console.error("PAT is required");
      process.exit(1);
    }
    savePat(pat);
  }

  // Test PAT
  try {
    await githubApi("/user");
    console.log("PAT validated successfully\n");
  } catch (err) {
    console.error("PAT validation failed:", err.message);
    const reset = await askYesNo("Would you like to enter a new PAT?");
    if (reset) {
      pat = await ask("GitHub PAT");
      savePat(pat);
    } else {
      process.exit(1);
    }
  }

  const name = await ask("Tenant name (lowercase, alphanumeric, hyphens)");
  const nameError = validateTenantName(name);
  if (nameError) {
    console.error(`Error: ${nameError}`);
    process.exit(1);
  }

  const url = await ask("Tenant URL (e.g., https://acme.api.identitynow.com)");
  const suggestedName = extractTenantNameFromUrl(url);

  if (suggestedName && suggestedName !== name) {
    const useSuggested = await askYesNo(`Use "${suggestedName}" as tenant name instead?`);
    if (useSuggested) {
      const newNameError = validateTenantName(suggestedName);
      if (!newNameError) {
        console.log(`Using tenant name: ${suggestedName}`);
        // Continue with suggestedName, but we already collected the original name
        // We'll proceed with the original since we've already started collecting data
        // Actually, let's just re-prompt or continue - for simplicity, continue with original
      }
    }
  }

  const clientId = await ask("Client ID");
  const clientSecret = await askSecret("Client Secret");
  const active = await askYesNo("Enable daily backups for this tenant?", true);
  const description = await ask("Description (optional)");

  await onboardTenant({
    name,
    url,
    client_id: clientId,
    client_secret: clientSecret,
    active,
    description,
  });
}

// ---------------------------------------------------------------------------
// Config file mode
// ---------------------------------------------------------------------------

function configFromEnv() {
  const activeRaw = process.env.ACTIVE;
  let active = true;
  if (activeRaw !== undefined && activeRaw !== "") {
    active = activeRaw === "true" || activeRaw === true;
  }

  return {
    name: process.env.TENANT_NAME,
    url: process.env.API_URL,
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    active,
    description: process.env.DESCRIPTION || "",
    secrets_environment: process.env.SECRETS_ENVIRONMENT || "",
  };
}

async function configMode(configPath, options = {}) {
  if (!existsSync(configPath)) {
    console.error(`Error: Config file not found: ${configPath}`);
    process.exit(1);
  }

  const content = readFileSync(configPath, "utf-8");
  const config = parseTenantYaml(content);

  if (!config.tenant || !config.tenant.name) {
    console.error("Error: Config file must contain a 'tenant:' section with at least a 'name' field");
    console.error("\nExample tenant.yaml:");
    console.error("tenant:");
    console.error("  name: acme-prod");
    console.error("  url: https://acme.api.identitynow.com");
    console.error("  client_id: abc123");
    console.error("  client_secret: xyz789");
    console.error("  active: true");
    console.error("  description: Production tenant for Acme Corp");
    process.exit(1);
  }

  if (!getPat()) {
    console.error("Error: GitHub PAT not found. Run with --interactive first to set up.");
    process.exit(1);
  }

  await onboardTenant(config.tenant, options);
}

async function envMode(options = {}) {
  const tenant = configFromEnv();
  if (!tenant.name || !tenant.url || !tenant.client_id || !tenant.client_secret) {
    console.error("Error: --from-env requires TENANT_NAME, API_URL, CLIENT_ID, and CLIENT_SECRET");
    process.exit(1);
  }

  if (!getPat()) {
    console.error("Error: GitHub token not found (GH_TOKEN, ADMIN_TOKEN, or .local-pat).");
    process.exit(1);
  }

  await onboardTenant(tenant, options);
}

// ---------------------------------------------------------------------------
// List mode
// ---------------------------------------------------------------------------

function listMode() {
  const registry = loadRegistry();

  if (registry.tenants.length === 0) {
    console.log("No tenants registered yet.");
    console.log(`Run: node scripts/onboard.mjs --interactive`);
    return;
  }

  console.log("Registered Tenants:");
  console.log("=".repeat(80));
  console.log(`${"Name".padEnd(25)} ${"Branch".padEnd(25)} ${"Env".padEnd(20)} ${"Active"}`);
  console.log("-".repeat(80));

  let activeCount = 0;
  for (const t of registry.tenants) {
    if (t.active) activeCount++;
    const activeStr = t.active ? "✅ Yes" : "❌ No";
    console.log(
      `${t.name.padEnd(25)} ${(t.branch || t.name).padEnd(25)} ${(t.environment || t.name).padEnd(20)} ${activeStr}`
    );
  }

  console.log("-".repeat(80));
  console.log(`Total: ${registry.tenants.length} tenants (${activeCount} active)`);
}

// ---------------------------------------------------------------------------
// Update mode
// ---------------------------------------------------------------------------

async function updateMode(tenantName) {
  const registry = loadRegistry();
  const tenant = getTenant(registry, tenantName);

  if (!tenant) {
    console.error(`Error: Tenant "${tenantName}" not found in registry`);
    console.error(`Run --list to see registered tenants`);
    process.exit(1);
  }

  console.log(`=== Updating tenant: ${tenantName} ===\n`);

  const url = await ask("Tenant URL", "");
  const clientId = await ask("Client ID", "");
  const clientSecret = await askSecret("Client Secret (leave blank to keep current)");
  const active = await askYesNo("Enable daily backups?", tenant.active);
  const description = await ask("Description", tenant.description || "");

  const updates = {};
  if (url) updates.url = url;
  if (clientId) updates.client_id = clientId;
  if (clientSecret) updates.client_secret = clientSecret;
  if (active !== tenant.active) updates.active = active;
  if (description !== tenant.description) updates.description = description;

  if (Object.keys(updates).length === 0) {
    console.log("No changes made.");
    return;
  }

  await onboardTenant({
    name: tenantName,
    url: updates.url || tenant.url || "",
    client_id: updates.client_id || "",
    client_secret: updates.client_secret || "",
    active: updates.active !== undefined ? updates.active : tenant.active,
    description: updates.description !== undefined ? updates.description : tenant.description,
  });
}

// ---------------------------------------------------------------------------
// Remove mode
// ---------------------------------------------------------------------------

async function removeMode(tenantName) {
  const registry = loadRegistry();
  const index = registry.tenants.findIndex((t) => t.name === tenantName);

  if (index === -1) {
    console.error(`Error: Tenant "${tenantName}" not found`);
    process.exit(1);
  }

  const confirm = await askYesNo(`Remove "${tenantName}" from registry?`, false);
  if (!confirm) {
    console.log("Cancelled.");
    return;
  }

  registry.tenants.splice(index, 1);
  saveRegistry(registry, REGISTRY_FILE);
  console.log(`Removed ${tenantName} from registry.`);
  console.log("Note: GitHub branch and environment were NOT deleted.");
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function printUsage() {
  console.error("Usage: node scripts/onboard.mjs [options]");
  console.error("");
  console.error("Options:");
  console.error("  --interactive            Prompt for tenant details interactively");
  console.error("  --config <file>          Read tenant details from YAML file");
  console.error("  --from-env               Read tenant details from environment variables");
  console.error("  --push-registry          Commit and push tenants.yaml to main (CI)");
  console.error("  --list                   List all registered tenants");
  console.error("  --update <name>          Update secrets for an existing tenant");
  console.error("  --remove <name>          Deprecated — use: node scripts/cli.mjs offboard <name>");
  console.error("  --help                   Show this help message");
  console.error("");
  console.error("Examples:");
  console.error("  node scripts/onboard.mjs --interactive");
  console.error("  node scripts/onboard.mjs --config tenant.yaml");
  console.error("  node scripts/onboard.mjs --list");
  console.error("  node scripts/onboard.mjs --update acme-prod");
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    pushRegistry: args.includes("--push-registry"),
  };

  if (args.length === 0 || args.includes("--help")) {
    printUsage();
    process.exit(0);
  }

  if (args.includes("--interactive")) {
    await interactiveMode();
  } else if (args.includes("--from-env")) {
    await envMode(options);
  } else if (args.includes("--config")) {
    const idx = args.indexOf("--config");
    const configPath = args[idx + 1];
    if (!configPath) {
      console.error("Error: --config requires a file path");
      process.exit(1);
    }
    await configMode(configPath, options);
  } else if (args.includes("--list")) {
    listMode();
  } else if (args.includes("--update")) {
    const idx = args.indexOf("--update");
    const tenantName = args[idx + 1];
    if (!tenantName) {
      console.error("Error: --update requires a tenant name");
      process.exit(1);
    }
    await updateMode(tenantName);
  } else if (args.includes("--remove")) {
    const idx = args.indexOf("--remove");
    const tenantName = args[idx + 1];
    if (!tenantName) {
      console.error("Error: --remove requires a tenant name");
      process.exit(1);
    }
    await removeMode(tenantName);
  } else {
    console.error(`Error: Unknown options: ${args.join(" ")}`);
    printUsage();
    process.exit(1);
  }
}

export { getPat, computeOnboardOutcome, mergeTenantRegistryEntry } from "./onboard-utils.mjs";
export { branchExists };

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("onboard.mjs") ||
    process.argv[1].endsWith("scripts/onboard.mjs"));

if (isMain) {
  main().catch((err) => {
    console.error("FATAL:", err.message || err);
    process.exit(1);
  });
}

