#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for create-backup-release.sh zip contents
//
// Usage: node scripts/test-create-backup-release.mjs
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, finalizeTests } from "./test-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const scriptPath = join(root, "scripts/create-backup-release.sh");
const tagScriptPath = join(root, "scripts/create-backup-tag.sh");

console.log("Testing create-backup-release.sh...\n");

function listZipEntries(zipPath) {
  const output = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf-8" });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function runDryRunZip(cwd, tagName, tenant) {
  return execFileSync("bash", [scriptPath, tagName, tenant], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, DRY_RUN: "1" },
  }).trim();
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

function initFixtureRepo() {
  const fixture = mkdtempSync(join(tmpdir(), "backup-release-git-"));
  git(["init"], fixture);
  git(["config", "user.email", "test@example.com"], fixture);
  git(["config", "user.name", "Test User"], fixture);

  mkdirSync(join(fixture, "backups", "ROLE"), { recursive: true });
  writeFileSync(join(fixture, "backups", "ROLE", "x.json"), '{"id":"x"}\n');
  writeFileSync(join(fixture, ".tenant.yaml"), "name: acme-prod\n");
  writeFileSync(
    join(fixture, ".gitignore"),
    "*\n!.gitignore\n!.tenant.yaml\n!backups/\n!backups/**\n"
  );

  git(["add", "-A"], fixture);
  git(["commit", "-m", "tenant branch snapshot"], fixture);
  return fixture;
}

function createBackupTag(fixture, tagName, sourceRef = "HEAD") {
  execFileSync("bash", [tagScriptPath, tagName, sourceRef], {
    cwd: fixture,
    env: { ...process.env, SKIP_TAG_PUSH: "1" },
  });
}

function runWithMockGh(cwd, mockGh, scriptArgs, extraEnv = {}) {
  const binDir = mkdtempSync(join(tmpdir(), "mock-gh-bin-"));
  const ghPath = join(binDir, "gh");
  writeFileSync(ghPath, mockGh, { mode: 0o755 });
  return execFileSync("bash", [scriptPath, ...scriptArgs], {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      GH_TOKEN: "test-token",
      ...extraEnv,
    },
  });
}

// zip contains flat backups/ paths
{
  const fixture = mkdtempSync(join(tmpdir(), "backup-release-"));
  mkdirSync(join(fixture, "backups", "ROLE"), { recursive: true });
  writeFileSync(join(fixture, "backups", "ROLE", "x.json"), '{"id":"x"}\n');
  writeFileSync(join(fixture, ".tenant.yaml"), "name: acme-prod\n");
  writeFileSync(join(fixture, ".gitignore"), "!backups/\n");

  const tagName = "acme-prod/2026-08-05_12-00-00";
  const zipPath = runDryRunZip(fixture, tagName, "acme-prod");
  const entries = listZipEntries(zipPath);

  assert(
    entries.some((entry) => entry.startsWith("backups/ROLE/")),
    "zip contains flat backups/TYPE paths"
  );
  assert(
    entries.some((entry) => entry.includes("ROLE/x.json")),
    "zip contains tenant JSON files"
  );
  assert(
    !entries.some((entry) => entry.includes(".tenant.yaml")),
    "zip excludes .tenant.yaml"
  );
  assert(
    !entries.some((entry) => entry.includes(".gitignore")),
    "zip excludes .gitignore"
  );

  rmSync(fixture, { recursive: true, force: true });
}

// missing backup dir skips with warning (exit 0, no zip path)
{
  const fixture = mkdtempSync(join(tmpdir(), "backup-release-"));
  const output = execFileSync("bash", [scriptPath, "acme-prod/2026-08-05_12-00-00", "acme-prod"], {
    cwd: fixture,
    encoding: "utf-8",
    env: { ...process.env, DRY_RUN: "1" },
  });
  assert(output.includes("skipping release"), "missing backup dir emits skip warning");

  rmSync(fixture, { recursive: true, force: true });
}

// full path: mock gh release create succeeds with tag and zip asset
{
  const fixture = mkdtempSync(join(tmpdir(), "backup-release-"));
  const logPath = join(fixture, "gh.log");
  mkdirSync(join(fixture, "backups", "ROLE"), { recursive: true });
  writeFileSync(join(fixture, "backups", "ROLE", "x.json"), '{"id":"x"}\n');

  const tagName = "acme-prod/2026-08-05_12-00-00";
  const mockGh = `#!/usr/bin/env bash
if [ "$1" = "release" ] && [ "$2" = "create" ]; then
  echo "tag=$3 asset=\${@: -1}" >> "${logPath}"
  exit 0
fi
echo "unexpected gh invocation: $*" >&2
exit 1
`;
  const output = runWithMockGh(fixture, mockGh, [tagName, "acme-prod"]);
  const ghLog = readFileSync(logPath, "utf-8");

  assert(output.includes("Created release"), "successful release path reports creation");
  assert(ghLog.includes(`tag=${tagName}`), "gh release create receives backup tag name");
  assert(ghLog.includes("acme-prod-2026-08-05_12-00-00.zip"), "gh release create receives zip asset");

  rmSync(fixture, { recursive: true, force: true });
}

// unchanged backup content vs previous tag skips release
{
  const fixture = initFixtureRepo();
  const prevTag = "acme-prod/2026-08-04_12-00-00";
  const tagName = "acme-prod/2026-08-05_12-00-00";
  createBackupTag(fixture, prevTag);
  createBackupTag(fixture, tagName);

  const logPath = join(fixture, "gh.log");
  const mockGh = `#!/usr/bin/env bash
if [ "$1" = "release" ] && [ "$2" = "create" ]; then
  echo "tag=$3" >> "${logPath}"
  exit 0
fi
exit 1
`;
  const output = runWithMockGh(fixture, mockGh, [tagName, "acme-prod"]);

  assert(output.includes("skipping release"), "unchanged tree emits skip message");
  assert(output.includes(prevTag), "skip message names previous tag");
  assert(!existsSync(logPath), "unchanged tree does not call gh release create");

  rmSync(fixture, { recursive: true, force: true });
}

// changed backup content vs previous tag creates release
{
  const fixture = initFixtureRepo();
  const prevTag = "acme-prod/2026-08-04_12-00-00";
  const tagName = "acme-prod/2026-08-05_12-00-00";
  createBackupTag(fixture, prevTag);

  writeFileSync(join(fixture, "backups", "ROLE", "y.json"), '{"id":"y"}\n');
  git(["add", "backups/ROLE/y.json"], fixture);
  git(["commit", "-m", "backup: 2026-08-05 change"], fixture);
  createBackupTag(fixture, tagName);

  const logPath = join(fixture, "gh.log");
  const mockGh = `#!/usr/bin/env bash
if [ "$1" = "release" ] && [ "$2" = "create" ]; then
  echo "tag=$3 asset=\${@: -1}" >> "${logPath}"
  exit 0
fi
exit 1
`;
  const output = runWithMockGh(fixture, mockGh, [tagName, "acme-prod"]);
  const ghLog = readFileSync(logPath, "utf-8");

  assert(output.includes("Created release"), "changed tree reports release creation");
  assert(ghLog.includes(`tag=${tagName}`), "changed tree calls gh release create");

  rmSync(fixture, { recursive: true, force: true });
}

// first restore-point tag creates release
{
  const fixture = initFixtureRepo();
  const tagName = "acme-prod/2026-08-05_12-00-00";
  createBackupTag(fixture, tagName);

  const logPath = join(fixture, "gh.log");
  const mockGh = `#!/usr/bin/env bash
if [ "$1" = "release" ] && [ "$2" = "create" ]; then
  echo "tag=$3" >> "${logPath}"
  exit 0
fi
exit 1
`;
  const output = runWithMockGh(fixture, mockGh, [tagName, "acme-prod"]);

  assert(output.includes("Created release"), "first tag creates release");
  assert(readFileSync(logPath, "utf-8").includes(`tag=${tagName}`), "first tag calls gh release create");

  rmSync(fixture, { recursive: true, force: true });
}

// release failure is non-fatal (exit 0, warning emitted)
{
  const fixture = mkdtempSync(join(tmpdir(), "backup-release-"));
  mkdirSync(join(fixture, "backups", "ROLE"), { recursive: true });
  writeFileSync(join(fixture, "backups", "ROLE", "x.json"), '{"id":"x"}\n');

  const tagName = "acme-prod/2026-08-05_12-00-00";
  const mockGh = `#!/usr/bin/env bash
if [ "$1" = "release" ] && [ "$2" = "create" ]; then
  echo "API error" >&2
  exit 1
fi
exit 1
`;
  let exitCode = 0;
  let output = "";
  try {
    output = runWithMockGh(fixture, mockGh, [tagName, "acme-prod"]);
  } catch (err) {
    exitCode = err.status ?? 1;
    output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }

  assert(exitCode === 0, "gh release failure exits 0 (non-fatal)");
  assert(
    output.includes("::warning::Could not create release"),
    "gh release failure emits warning annotation"
  );

  rmSync(fixture, { recursive: true, force: true });
}

// script header exists
{
  const content = readFileSync(scriptPath, "utf-8");
  assert(content.includes("create-backup-release.sh"), "script header documents usage");
  assert(content.includes("DRY_RUN=1"), "script documents DRY_RUN mode");
  assert(content.includes("skipping release"), "script documents unchanged-content skip");
  assert(
    !content.includes("Manual backup restore point"),
    "release notes are workflow-neutral (not manual-only)"
  );
}

finalizeTests();
