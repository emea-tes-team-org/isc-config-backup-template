// ---------------------------------------------------------------------------
// Guard against committing a package-lock.json that resolves tarballs from an
// internal npm mirror (e.g. a corporate Artifactory instance). GitHub-hosted
// Actions runners cannot reach internal mirrors, so "resolved" URLs must
// always point at the public npm registry.
//
// Usage:
//   node scripts/check-lockfile-registry.mjs         # check only, exits 1 on violation
//   node scripts/check-lockfile-registry.mjs --fix    # rewrite violations in place
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync } from "node:fs";

const LOCKFILE = new URL("../package-lock.json", import.meta.url);
const PUBLIC_REGISTRY = "https://registry.npmjs.org/";

// Any host other than the public registry is disallowed in committed lockfiles.
const ALLOWED_HOST = "registry.npmjs.org";

const fix = process.argv.includes("--fix");

const raw = readFileSync(LOCKFILE, "utf8");
const lock = JSON.parse(raw);

const violations = [];

for (const [key, pkg] of Object.entries(lock.packages ?? {})) {
  if (!pkg.resolved || typeof pkg.resolved !== "string") continue;
  if (!pkg.resolved.startsWith("http")) continue; // skip "file:" / workspace links

  const url = new URL(pkg.resolved);
  if (url.hostname === ALLOWED_HOST) continue;

  violations.push({ key, pkg, resolved: pkg.resolved });
}

if (violations.length === 0) {
  console.log(`OK: all ${Object.keys(lock.packages ?? {}).length} lockfile entries resolve from ${ALLOWED_HOST}.`);
  process.exit(0);
}

console.error(`Found ${violations.length} lockfile ${violations.length === 1 ? "entry" : "entries"} resolving from a non-public registry:`);
for (const { key, resolved } of violations) {
  console.error(`  - ${key}: ${resolved}`);
}

if (!fix) {
  console.error("\nThis breaks `npm ci` on GitHub Actions runners, which cannot reach internal mirrors.");
  console.error("Re-run with --fix to rewrite these entries to the public npm registry (safe: the");
  console.error("tarball content and integrity hash are identical, since internal mirrors only proxy");
  console.error("the public registry). Then re-run `npm ci` locally to confirm it still installs.");
  process.exit(1);
}

for (const { pkg } of violations) {
  const url = new URL(pkg.resolved);
  // Standard npm tarball path convention: /<name>/-/<name>-<version>.tgz
  // (or /@scope/<name>/-/<name>-<version>.tgz for scoped packages).
  const tarballPath = url.pathname.replace(/^.*?\/((?:@[^/]+\/)?[^/]+\/-\/[^/]+\.tgz)$/, "$1");
  pkg.resolved = `${PUBLIC_REGISTRY}${tarballPath}`;
}

writeFileSync(LOCKFILE, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`Fixed ${violations.length} lockfile ${violations.length === 1 ? "entry" : "entries"}. Review the diff and re-run \`npm ci\` to confirm it still installs.`);
