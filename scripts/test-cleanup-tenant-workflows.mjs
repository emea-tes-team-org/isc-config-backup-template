#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for cleanup-tenant-workflows.mjs
//
// Usage: node scripts/test-cleanup-tenant-workflows.mjs
// ---------------------------------------------------------------------------

import { cleanupTenantWorkflows } from "./cleanup-tenant-workflows.mjs";
import { assert, finalizeTests } from "./test-utils.mjs";

console.log("Testing cleanup-tenant-workflows...\n");

const calls = [];
const fakeGit = (args, cwd) => {
  calls.push(`${cwd ?? "root"}:${args.join(" ")}`);
  if (args[0] === "ls-remote") return "abc123\trefs/heads/fernando";
  return "";
};
const fakeGitOrNull = (args, cwd) => {
  if (args[0] === "ls-remote" && args[2] === "missing") return null;
  return fakeGit(args, cwd);
};

calls.length = 0;
const dry = cleanupTenantWorkflows(["fernando"], { dryRun: true }, {
  runGit: fakeGit,
  runGitOrNull: fakeGitOrNull,
  existsSync: () => true,
  mkWorkDir: () => "/tmp/fake-worktree",
  log: () => {},
});
assert(dry.cleaned.includes("fernando"), "dry-run marks tenant as cleaned");
assert(
  calls.some((c) => c.includes("worktree add -B cleanup-wf-fernando")),
  "dry-run uses isolated worktree"
);

calls.length = 0;
const missing = cleanupTenantWorkflows(["missing"], {}, {
  runGit: fakeGit,
  runGitOrNull: () => null,
  mkWorkDir: () => "/tmp/fake-worktree",
  log: () => {},
});
assert(missing.skipped.includes("missing"), "missing branch skipped");

finalizeTests();
