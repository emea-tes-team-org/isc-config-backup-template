#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for create-backup-tag.sh — backups-only restore-point tags
//
// Usage: node scripts/test-create-backup-tag.mjs
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, finalizeTests } from "./test-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const scriptPath = join(root, "scripts/create-backup-tag.sh");

console.log("Testing create-backup-tag.sh...\n");

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

function initFixtureRepo() {
  const fixture = mkdtempSync(join(tmpdir(), "backup-tag-"));
  git(["init"], fixture);
  git(["config", "user.email", "test@example.com"], fixture);
  git(["config", "user.name", "Test User"], fixture);

  mkdirSync(join(fixture, "backups", "ROLE"), { recursive: true });
  writeFileSync(
    join(fixture, "backups", "ROLE", "x.json"),
    '{"id":"x"}\n'
  );
  writeFileSync(join(fixture, ".tenant.yaml"), "name: acme-prod\n");
  writeFileSync(join(fixture, ".gitignore"), "*\n!.gitignore\n!.tenant.yaml\n!backups/\n!backups/**\n");

  git(["add", "-A"], fixture);
  git(["commit", "-m", "tenant branch snapshot"], fixture);
  return fixture;
}

function createTag(fixture, tagName, sourceRef = "HEAD") {
  execFileSync("bash", [scriptPath, tagName, sourceRef], {
    cwd: fixture,
    env: { ...process.env, SKIP_TAG_PUSH: "1" },
  });
}

function pathExistsAtRef(fixture, ref, path) {
  try {
    git(["cat-file", "-e", `${ref}:${path}`], fixture);
    return true;
  } catch {
    return false;
  }
}

// tag tree contains flat backups/ paths
{
  const fixture = initFixtureRepo();
  const tagName = "acme-prod/2026-08-05_12-00-00";
  createTag(fixture, tagName);

  const rootEntries = git(["ls-tree", "--name-only", `${tagName}^{tree}`], fixture);
  assert(rootEntries === "backups", "tag tree root contains only backups/");

  assert(
    pathExistsAtRef(fixture, tagName, "backups/ROLE/x.json"),
    "tag tree contains flat backups/TYPE paths"
  );

  rmSync(fixture, { recursive: true, force: true });
}

// tag tree excludes branch metadata
{
  const fixture = initFixtureRepo();
  const tagName = "acme-prod/2026-08-05_12-00-00";
  createTag(fixture, tagName);

  assert(
    !pathExistsAtRef(fixture, tagName, ".tenant.yaml"),
    "tag tree excludes .tenant.yaml"
  );
  assert(
    !pathExistsAtRef(fixture, tagName, ".gitignore"),
    "tag tree excludes .gitignore"
  );

  rmSync(fixture, { recursive: true, force: true });
}

// tag commit SHA differs from branch HEAD
{
  const fixture = initFixtureRepo();
  const tagName = "acme-prod/2026-08-05_12-00-00";
  createTag(fixture, tagName);

  const headSha = git(["rev-parse", "HEAD"], fixture);
  const tagSha = git(["rev-parse", tagName], fixture);
  assert(headSha !== tagSha, "tag commit SHA differs from branch HEAD");

  rmSync(fixture, { recursive: true, force: true });
}

// restore path readable at tag
{
  const fixture = initFixtureRepo();
  const tagName = "acme-prod/2026-08-05_12-00-00";
  createTag(fixture, tagName);

  const content = git(["show", `${tagName}:backups/ROLE/x.json`], fixture);
  assert(content.includes('"id":"x"'), "restore path backups/TYPE/... readable at tag");

  rmSync(fixture, { recursive: true, force: true });
}

// missing backups/ tree fails fast
{
  const fixture = mkdtempSync(join(tmpdir(), "backup-tag-empty-"));
  git(["init"], fixture);
  git(["config", "user.email", "test@example.com"], fixture);
  git(["config", "user.name", "Test User"], fixture);
  writeFileSync(join(fixture, ".tenant.yaml"), "name: acme-prod\n");
  git(["add", ".tenant.yaml"], fixture);
  git(["commit", "-m", "no backups"], fixture);

  let failed = false;
  try {
    execFileSync("bash", [scriptPath, "acme-prod/2026-08-05_12-00-00"], {
      cwd: fixture,
      env: { ...process.env, SKIP_TAG_PUSH: "1" },
      stdio: "pipe",
    });
  } catch (err) {
    failed = err.status !== 0;
    assert(
      String(err.stderr || err.stdout || "").includes("no backups/ tree"),
      "missing backups/ tree fails with clear error"
    );
  }
  assert(failed, "missing backups/ tree exits non-zero");

  rmSync(fixture, { recursive: true, force: true });
}

// script header documents usage
{
  const content = readFileSync(scriptPath, "utf-8");
  assert(content.includes("create-backup-tag.sh"), "script header documents usage");
  assert(content.includes("backups only"), "script header documents tree semantics");
}

finalizeTests();
