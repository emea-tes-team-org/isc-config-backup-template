#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for flat backup path resolution in restore.mjs
//
// Usage: node scripts/test-restore.mjs
// ---------------------------------------------------------------------------

import { execFileSync } from "child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { backupObjectPosix, BACKUP_DIR } from "./backup-path-utils.mjs";
import { assert, finalizeTests } from "./test-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

function initFlatBackupRepo() {
  const fixture = mkdtempSync(join(tmpdir(), "restore-flat-"));
  git(["init"], fixture);
  git(["config", "user.email", "test@example.com"], fixture);
  git(["config", "user.name", "Test User"], fixture);

  mkdirSync(join(fixture, "backups", "ROLE"), { recursive: true });
  writeFileSync(
    join(fixture, "backups", "ROLE", "obj1.json"),
    JSON.stringify({ self: { type: "ROLE", name: "Test Role" }, object: { id: "obj1" } })
  );
  writeFileSync(join(fixture, ".tenant.yaml"), "name: fernando\n");
  git(["add", "-A"], fixture);
  git(["commit", "-m", "flat backup"], fixture);
  git(["tag", "fernando/2026-08-12_00-00-00"], fixture);
  return fixture;
}

console.log("Testing restore flat path resolution...\n");

// backupObjectPosix uses flat layout
{
  assert(
    backupObjectPosix("ROLE", "obj1") === "backups/ROLE/obj1.json",
    "backupObjectPosix returns flat path"
  );
  assert(BACKUP_DIR === "backups", "BACKUP_DIR is backups");
}

// git ls-tree finds flat paths at tag ref
{
  const fixture = initFlatBackupRepo();
  const tag = "fernando/2026-08-12_00-00-00";
  const files = git(
    ["ls-tree", "-r", "--name-only", tag, "--", "backups/"],
    fixture
  );
  assert(files.includes("backups/ROLE/obj1.json"), "tag ref lists flat backup paths");
  assert(!files.includes("backups/fernando/ROLE/obj1.json"), "no nested tenant prefix at tag");

  const content = git(["show", `${tag}:backups/ROLE/obj1.json`], fixture);
  assert(content.includes("obj1"), "object readable at flat tag path");
  rmSync(fixture, { recursive: true, force: true });
}

// restore dry-run reads flat local backups/
{
  const fixture = initFlatBackupRepo();
  let output = "";
  let exitCode = 0;
  try {
    output = execFileSync(
      "node",
      [
        join(root, "scripts/restore.mjs"),
        "local",
        "--dry-run",
        "--full",
      ],
      {
        cwd: fixture,
        encoding: "utf-8",
        env: {
          ...process.env,
          TENANT_URL: "https://demo.api.identitynow.com",
          CLIENT_ID: "test",
          CLIENT_SECRET: "test",
          TENANT_NAME: "fernando",
        },
      }
    );
  } catch (err) {
    exitCode = err.status ?? 1;
    output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }

  assert(exitCode === 0, "restore local dry-run exits 0");
  assert(output.includes("backups/"), "restore reads from flat backups/");
  assert(output.includes("ROLE"), "restore finds ROLE objects");
  rmSync(fixture, { recursive: true, force: true });
}

// restore from git tag ref
{
  const fixture = initFlatBackupRepo();
  let output = "";
  let exitCode = 0;
  try {
    output = execFileSync(
      "node",
      [
        join(root, "scripts/restore.mjs"),
        "fernando/2026-08-12_00-00-00",
        "--tenant",
        "fernando",
        "--dry-run",
        "--full",
      ],
      {
        cwd: fixture,
        encoding: "utf-8",
        env: {
          ...process.env,
          TENANT_URL: "https://demo.api.identitynow.com",
          CLIENT_ID: "test",
          CLIENT_SECRET: "test",
          TENANT_NAME: "fernando",
        },
      }
    );
  } catch (err) {
    exitCode = err.status ?? 1;
    output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }

  assert(exitCode === 0, "restore from tag dry-run exits 0");
  assert(output.includes("1 object"), "restore from tag finds objects");
  rmSync(fixture, { recursive: true, force: true });
}

// restore from a branch that only exists as a remote-tracking ref (CI checkout)
{
  const origin = initFlatBackupRepo();
  git(["branch", "fernando"], origin);

  const clone = mkdtempSync(join(tmpdir(), "restore-clone-"));
  const workdir = join(clone, "repo");
  git(["clone", origin, workdir], clone);

  assert(
    execFileSync("git", ["branch", "--list", "fernando"], { cwd: workdir, encoding: "utf-8" }).trim() === "",
    "clone has no local branch for the source tenant"
  );

  let output = "";
  let exitCode = 0;
  try {
    output = execFileSync(
      "node",
      [
        join(root, "scripts/restore.mjs"),
        "fernando",
        "--tenant",
        "fernando",
        "--dry-run",
        "--full",
      ],
      {
        cwd: workdir,
        encoding: "utf-8",
        env: {
          ...process.env,
          TENANT_URL: "https://demo.api.identitynow.com",
          CLIENT_ID: "test",
          CLIENT_SECRET: "test",
          TENANT_NAME: "fernando",
        },
      }
    );
  } catch (err) {
    exitCode = err.status ?? 1;
    output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }

  assert(exitCode === 0, "restore from remote-only branch dry-run exits 0");
  assert(output.includes("origin/fernando"), "restore falls back to origin/<branch>");
  assert(output.includes("1 object"), "restore from remote-only branch finds objects");
  rmSync(origin, { recursive: true, force: true });
  rmSync(clone, { recursive: true, force: true });
}

finalizeTests();
