#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for scripts/generate-backup-stats.mjs
//
// Usage: node scripts/test-generate-backup-stats.mjs
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import cp from "child_process";
import { syncBuiltinESMExports } from "module";
import { assert, assertDeepEqual, finalizeTests } from "./test-utils.mjs";

const TEST_DIR = "test-backups-mock-dir";

console.log("Testing generate-backup-stats.mjs...\n");

async function runTests() {
  const originalExecFileSync = cp.execFileSync;

  try {
    // ---------------------------------------------------------------------------
    // Setup temporary directory
    // ---------------------------------------------------------------------------
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }

    const { computeBackupStats } = await import("./generate-backup-stats.mjs");

    // ---------------------------------------------------------------------------
    // 1. Missing directory
    // ---------------------------------------------------------------------------
    {
      const stats = computeBackupStats("some-missing-directory");
      assertDeepEqual(
        stats,
        { size: 0, files: 0, added: 0, deleted: 0, modified: 0 },
        "computeBackupStats: missing directory returns all zeros"
      );
    }

    // ---------------------------------------------------------------------------
    // 2. Empty directory
    // ---------------------------------------------------------------------------
    {
      fs.mkdirSync(TEST_DIR, { recursive: true });
      cp.execFileSync = () => ""; // Mock git output for empty dir
      syncBuiltinESMExports();

      const stats = computeBackupStats(TEST_DIR);
      assertDeepEqual(
        stats,
        { size: 0, files: 0, added: 0, deleted: 0, modified: 0 },
        "computeBackupStats: empty directory returns all zeros"
      );
    }

    // ---------------------------------------------------------------------------
    // 3. Directory with files and valid git status output
    // ---------------------------------------------------------------------------
    {
      const file1 = path.join(TEST_DIR, "file1.txt");
      const file2 = path.join(TEST_DIR, "file2.txt");
      const subDir = path.join(TEST_DIR, "subdir");
      const file3 = path.join(subDir, "file3.txt");

      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(file1, "hello");       // 5 bytes
      fs.writeFileSync(file2, "world");       // 5 bytes
      fs.writeFileSync(file3, "hello world"); // 11 bytes

      const expectedSize = 5 + 5 + 11;

      cp.execFileSync = (cmd, args) => {
        assert(cmd === "git", "computeBackupStats: calls git");
        assertDeepEqual(args.slice(0, 2), ["status", "--porcelain"], "computeBackupStats: calls git status --porcelain");
        assert(args[2] === TEST_DIR, "computeBackupStats: passes directory to git");

        return "A  file1.txt\n?? subdir/file3.txt\n M file2.txt\n D deleted.txt\n";
      };
      syncBuiltinESMExports();

      const stats = computeBackupStats(TEST_DIR);
      assertDeepEqual(
        stats,
        { size: expectedSize, files: 3, added: 2, deleted: 1, modified: 1 },
        "computeBackupStats: valid directory returns correct stats"
      );
    }

    // ---------------------------------------------------------------------------
    // 4. Exception handling in git status
    // ---------------------------------------------------------------------------
    {
      cp.execFileSync = () => {
        throw new Error("Git command failed");
      };
      syncBuiltinESMExports();

      const stats = computeBackupStats(TEST_DIR);
      assertDeepEqual(
        stats,
        { size: 21, files: 3, added: 0, deleted: 0, modified: 0 },
        "computeBackupStats: handles git command failure gracefully"
      );
    }

  } finally {
    // Restore mocks
    cp.execFileSync = originalExecFileSync;
    syncBuiltinESMExports();

    // Clean up temporary directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  }

  finalizeTests();
}

await runTests();
