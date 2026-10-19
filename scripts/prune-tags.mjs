#!/usr/bin/env node
// ---------------------------------------------------------------------------
// ISC Backup Tag Retention
//
// Prunes remote backup git tags to the N newest restore points per tenant
// prefix. Tags must match `<tenant>/YYYY-MM-DD_HH-MM-SS` (UTC embedded).
//
// Usage:
//   node scripts/prune-tags.mjs [--keep N]
//
// Examples:
//   node scripts/prune-tags.mjs
//   node scripts/prune-tags.mjs --keep 7
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseTagTimestamp } from "./parse-tenants.mjs";

const DEFAULT_KEEP = 7;
const DEFAULT_CHUNK_SIZE = 50;

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf-8",
    stdio: options.stdio ?? ["pipe", "pipe", "pipe"],
    ...options,
  });
}

function runGh(args, options = {}) {
  return execFileSync("gh", args, {
    encoding: "utf-8",
    stdio: options.stdio ?? ["pipe", "pipe", "pipe"],
    ...options,
  });
}

/**
 * Delete a GitHub Release for a backup tag. Missing releases are ignored.
 * Returns true when a release was deleted.
 */
export function deleteReleaseForTag(tag, ghRunner = runGh) {
  try {
    ghRunner(["release", "delete", tag, "--yes"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    return true;
  } catch (err) {
    const message = `${err.stderr ?? ""}${err.stdout ?? ""}${err.message ?? ""}`;
    if (
      message.includes("release not found") ||
      message.includes("Not Found") ||
      message.includes("HTTP 404")
    ) {
      return false;
    }
    console.warn(`::warning::Could not delete release ${tag}: ${message.trim() || "unknown error"}`);
    return false;
  }
}

/** Delete GitHub Releases for pruned backup tags. */
export function deleteReleasesForTags(tags, deleteFn = deleteReleaseForTag) {
  let deleted = 0;
  for (const tag of tags) {
    if (deleteFn(tag)) {
      deleted += 1;
    }
  }
  return deleted;
}

/**
 * Group tag names by tenant prefix (text before the first `/`).
 */
export function groupTagsByPrefix(tags) {
  const groups = new Map();
  for (const tag of tags) {
    const slashIndex = tag.indexOf("/");
    if (slashIndex === -1) {
      continue;
    }
    const prefix = tag.slice(0, slashIndex);
    if (!groups.has(prefix)) {
      groups.set(prefix, []);
    }
    groups.get(prefix).push(tag);
  }
  return groups;
}

function sortValidTagsByTimestamp(tags) {
  return tags
    .map((tag) => ({ tag, ts: parseTagTimestamp(tag) }))
    .filter((entry) => entry.ts !== null)
    .sort((a, b) => b.ts.getTime() - a.ts.getTime());
}

/**
 * Return backup tags to delete — all but the `keep` newest by embedded timestamp.
 * Tags without a parseable timestamp are excluded from both keep and delete sets.
 */
export function selectTagsToDelete(tags, keep = DEFAULT_KEEP) {
  const sorted = sortValidTagsByTimestamp(tags);
  if (sorted.length <= keep) {
    return [];
  }
  return sorted.slice(keep).map((entry) => entry.tag);
}

/** Return backup tags to keep — the `keep` newest by embedded timestamp. */
export function selectTagsToKeep(tags, keep = DEFAULT_KEEP) {
  return sortValidTagsByTimestamp(tags)
    .slice(0, keep)
    .map((entry) => entry.tag);
}

/** List all tag names on origin. */
export function listRemoteTags(gitRunner = runGit) {
  const output = gitRunner(["ls-remote", "--tags", "origin"]);
  const tags = [];
  for (const line of output.split("\n")) {
    const match = line.match(/refs\/tags\/(.+?)(?:\^\{\})?$/);
    if (match) {
      tags.push(match[1]);
    }
  }
  return [...new Set(tags)];
}

/** Push refspec deletions for one chunk of tags. */
export function deleteRemoteTagChunk(tags, gitRunner = runGit) {
  if (tags.length === 0) {
    return;
  }
  const refspecs = tags.map((tag) => `:refs/tags/${tag}`);
  gitRunner(["push", "origin", ...refspecs], { stdio: "ignore" });
}

/**
 * Delete tags in batches via `deleteFn`, defaulting to one push per chunk.
 */
export function deleteRemoteTagsBatch(
  tags,
  deleteFn = deleteRemoteTagChunk,
  chunkSize = DEFAULT_CHUNK_SIZE
) {
  let batches = 0;
  for (let i = 0; i < tags.length; i += chunkSize) {
    deleteFn(tags.slice(i, i + chunkSize));
    batches += 1;
  }
  return batches;
}

/**
 * Build per-prefix retention summary and optionally delete stale tags.
 */
export function pruneTags({
  keep = DEFAULT_KEEP,
  allTags,
  deleteBatch = deleteRemoteTagsBatch,
  releaseDeleteFn = deleteReleaseForTag,
} = {}) {
  const tags = allTags ?? listRemoteTags();
  const groups = groupTagsByPrefix(tags);
  const prefixes = [];
  const toDelete = [];

  for (const [prefix, prefixTags] of groups) {
    const keptTags = selectTagsToKeep(prefixTags, keep);
    const deletedTags = selectTagsToDelete(prefixTags, keep);
    const keptSet = new Set(keptTags);
    const deleteSet = new Set(deletedTags);
    const skipped = prefixTags.filter((tag) => !keptSet.has(tag) && !deleteSet.has(tag));

    prefixes.push({
      prefix,
      kept: keptTags.length,
      deleted: deletedTags.length,
      skipped: skipped.length,
      keptTags,
      deletedTags,
    });
    toDelete.push(...deletedTags);
  }

  prefixes.sort((a, b) => a.prefix.localeCompare(b.prefix));

  let deleteBatches = 0;
  let totalReleasesDeleted = 0;
  if (toDelete.length > 0) {
    deleteBatches = deleteBatch(toDelete);
    totalReleasesDeleted = deleteReleasesForTags(toDelete, releaseDeleteFn);
  }

  return {
    keep,
    prefixes,
    totalDeleted: toDelete.length,
    totalReleasesDeleted,
    deleteBatches,
  };
}

export function formatPruneSummary(result) {
  const lines = [
    "## Prune complete",
    "",
    `Retention: ${result.keep} newest restore point(s) per tenant prefix`,
    "",
    "| Prefix | Kept | Deleted | Skipped |",
    "| --- | ---: | ---: | ---: |",
  ];

  for (const row of result.prefixes) {
    lines.push(`| ${row.prefix} | ${row.kept} | ${row.deleted} | ${row.skipped} |`);
  }

  lines.push("");
  lines.push(`Deleted **${result.totalDeleted}** tag(s) across ${result.prefixes.length} prefix(es).`);
  if (typeof result.totalReleasesDeleted === "number") {
    lines.push(`Deleted **${result.totalReleasesDeleted}** GitHub release(s) for pruned tags.`);
  }

  return lines.join("\n");
}

function writeStepSummary(markdown) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, `${markdown}\n`);
  }
}

export function parseArgs(argv) {
  const args = argv.slice(2);
  let keep = DEFAULT_KEEP;

  const keepIndex = args.indexOf("--keep");
  if (keepIndex !== -1 && args[keepIndex + 1]) {
    const parsed = Number.parseInt(args[keepIndex + 1], 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      keep = parsed;
    }
  }

  return { keep };
}

function main() {
  const { keep } = parseArgs(process.argv);
  const result = pruneTags({ keep });
  const summary = formatPruneSummary(result);

  console.log(summary);
  writeStepSummary(summary);
  console.log(
    `Deleted ${result.totalDeleted} tag(s) and ${result.totalReleasesDeleted} release(s) in ${result.deleteBatches} batch(es).`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}


