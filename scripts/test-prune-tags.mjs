#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for prune-tags.mjs
//
// Usage: node scripts/test-prune-tags.mjs
// ---------------------------------------------------------------------------

import {
  groupTagsByPrefix,
  selectTagsToDelete,
  selectTagsToKeep,
  deleteRemoteTagChunk,
  deleteRemoteTagsBatch,
  deleteReleaseForTag,
  deleteReleasesForTags,
  pruneTags,
  formatPruneSummary,
  parseArgs,
} from "./prune-tags.mjs";
import { assert, assertDeepEqual, assertSameTagSet, finalizeTests } from "./test-utils.mjs";

console.log("Testing prune-tags.mjs...\n");

function makeDailyTags(prefix, startDay, count) {
  return Array.from({ length: count }, (_, index) => {
    const day = String(startDay + index).padStart(2, "0");
    return `${prefix}/2026-08-${day}_00-00-00`;
  });
}

// groupTagsByPrefix
{
  const groups = groupTagsByPrefix([
    "acme-prod/2026-08-01_00-00-00",
    "acme-prod/2026-08-02_00-00-00",
    "acme-dev/2026-08-01_00-00-00",
    "no-slash-tag",
  ]);
  assert(groups.size === 2, "groupTagsByPrefix groups by prefix");
  assert(groups.get("acme-prod").length === 2, "groupTagsByPrefix acme-prod count");
  assert(groups.get("acme-dev").length === 1, "groupTagsByPrefix acme-dev count");
}

// selectTagsToDelete: 10 tags -> delete 3 oldest
{
  const tags = makeDailyTags("acme-prod", 1, 10);
  const toDelete = selectTagsToDelete(tags, 7);
  assert(toDelete.length === 3, "selectTagsToDelete removes 3 when 10 tags");
  assertSameTagSet(
    toDelete,
    makeDailyTags("acme-prod", 1, 3),
    "selectTagsToDelete removes oldest tags"
  );
}

// selectTagsToDelete: <=7 tags -> no-op
{
  const tags = makeDailyTags("acme-prod", 1, 5);
  assertDeepEqual(selectTagsToDelete(tags, 7), [], "selectTagsToDelete no-op at 5 tags");
}

// embedded timestamp sort (input order irrelevant)
{
  const tags = [
    "mediolanum/2026-07-01_00-00-00",
    "mediolanum/2026-08-10_00-00-00",
    "mediolanum/2026-08-01_00-00-00",
  ];
  const extra = makeDailyTags("mediolanum", 2, 7);
  const allTags = [...tags, ...extra.filter((tag) => !tags.includes(tag))];
  const kept = selectTagsToKeep(allTags, 7);
  assert(kept.includes("mediolanum/2026-08-10_00-00-00"), "newest embedded timestamp kept");
  assert(!kept.includes("mediolanum/2026-07-01_00-00-00"), "oldest embedded timestamp deleted");
}

// malformed tags skipped
{
  const tags = [
    "acme-prod/latest",
    "acme-prod/2026-08-01_00-00-00",
    "acme-prod/2026-08-02_00-00-00",
  ];
  const toDelete = selectTagsToDelete(tags, 1);
  assert(toDelete.length === 1, "malformed tags excluded from delete set size");
  assert(toDelete[0] === "acme-prod/2026-08-01_00-00-00", "malformed tag not deleted");
  const kept = selectTagsToKeep(tags, 1);
  assertDeepEqual(kept, ["acme-prod/2026-08-02_00-00-00"], "valid newest tag kept");
}

// orphan prefix pruned
{
  const tags = makeDailyTags("old-tenant", 1, 10);
  const result = pruneTags({
    keep: 7,
    allTags: tags,
    deleteBatch: () => 0,
    releaseDeleteFn: () => false,
  });
  assert(result.prefixes.length === 1, "orphan prefix included in prune");
  assert(result.prefixes[0].prefix === "old-tenant", "orphan prefix name preserved");
  assert(result.totalDeleted === 3, "orphan prefix pruned to 7 tags");
}

// pruneTags deletes stale tags
{
  const tags = makeDailyTags("acme-prod", 1, 10);
  const deletedChunks = [];
  const result = pruneTags({
    keep: 7,
    allTags: tags,
    deleteBatch: (batchTags) => {
      deletedChunks.push([...batchTags]);
      return 1;
    },
    releaseDeleteFn: () => false,
  });
  assert(result.totalDeleted === 3, "pruneTags deletes stale tags");
  assertSameTagSet(deletedChunks[0], makeDailyTags("acme-prod", 1, 3), "pruneTags deletes oldest chunk");
}


// deleteRemoteTagChunk
{
  let gitArgs = null;
  const mockRunner = (args) => {
    gitArgs = args;
  };

  deleteRemoteTagChunk([], mockRunner);
  assert(gitArgs === null, "deleteRemoteTagChunk ignores empty tag list");

  deleteRemoteTagChunk(["acme-prod/2026-08-01", "acme-prod/2026-08-02"], mockRunner);
  assertDeepEqual(
    gitArgs,
    ["push", "origin", ":refs/tags/acme-prod/2026-08-01", ":refs/tags/acme-prod/2026-08-02"],
    "deleteRemoteTagChunk pushes correct refspecs"
  );
}

// deleteRemoteTagsBatch chunks
{
  const tags = makeDailyTags("acme-prod", 1, 120);
  const chunkSizes = [];
  deleteRemoteTagsBatch(
    tags,
    (chunk) => {
      chunkSizes.push(chunk.length);
    },
    50
  );
  assertDeepEqual(chunkSizes, [50, 50, 20], "deleteRemoteTagsBatch chunks at 50");
}

// formatPruneSummary includes table
{
  const summary = formatPruneSummary({
    keep: 7,
    prefixes: [{ prefix: "acme-prod", kept: 7, deleted: 3, skipped: 0 }],
    totalDeleted: 3,
    totalReleasesDeleted: 2,
  });
  assert(summary.includes("acme-prod"), "formatPruneSummary lists prefix");
  assert(summary.includes("Deleted **3**"), "formatPruneSummary deleted tag total");
  assert(summary.includes("Deleted **2** GitHub release"), "formatPruneSummary deleted release total");
}

// deleteReleasesForTags removes releases for pruned tags
{
  const deletedTags = [];
  const deleted = deleteReleasesForTags(
    makeDailyTags("acme-prod", 1, 3),
    (tag) => {
      deletedTags.push(tag);
      return true;
    }
  );
  assert(deleted === 3, "deleteReleasesForTags deletes one release per tag");
  assertDeepEqual(
    deletedTags,
    makeDailyTags("acme-prod", 1, 3),
    "deleteReleasesForTags calls delete for each tag"
  );
}

// deleteReleaseForTag ignores missing releases
{
  let deleted = false;
  try {
    deleted = deleteReleaseForTag("acme-prod/1900-01-01_00-00-00", () => {
      const err = new Error("release not found");
      err.stderr = "release not found";
      throw err;
    });
  } catch {
    deleted = null;
  }
  assert(deleted === false, "deleteReleaseForTag ignores missing release");
}

// pruneTags deletes matching releases
{
  const releaseDeletes = [];
  const result = pruneTags({
    keep: 7,
    allTags: makeDailyTags("acme-prod", 1, 10),
    deleteBatch: () => 1,
    releaseDeleteFn: (tag) => {
      releaseDeletes.push(tag);
      return true;
    },
  });
  assert(result.totalReleasesDeleted === 3, "pruneTags deletes releases for pruned tags");
  assertSameTagSet(releaseDeletes, makeDailyTags("acme-prod", 1, 3), "pruneTags release delete set matches tag delete set");
}

// formatPruneSummary includes table (legacy case without release count)
{
  const summary = formatPruneSummary({
    keep: 7,
    prefixes: [{ prefix: "acme-prod", kept: 7, deleted: 3, skipped: 0 }],
    totalDeleted: 3,
  });
  assert(summary.includes("acme-prod"), "formatPruneSummary lists prefix without release field");
  assert(summary.includes("Deleted **3**"), "formatPruneSummary deleted total without release field");
}

// parseArgs
{
  assertDeepEqual(parseArgs(["node", "prune-tags.mjs", "--keep", "5"]), { keep: 5 }, "parseArgs keep");
  assertDeepEqual(parseArgs(["node", "prune-tags.mjs"]), { keep: 7 }, "parseArgs defaults");
}

// branch/registry unchanged — pruneTags only computes tag sets (design constraint)
{
  const result = pruneTags({
    keep: 7,
    allTags: makeDailyTags("acme-prod", 1, 10),
    deleteBatch: () => 0,
  });
  assert(
    result.prefixes.every((row) => typeof row.kept === "number"),
    "pruneTags summary is tag-only (no registry or branch mutation)"
  );
}

finalizeTests();

