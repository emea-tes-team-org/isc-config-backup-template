#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for offboard.mjs
//
// Usage: node scripts/test-offboard.mjs
// ---------------------------------------------------------------------------

import { writeFileSync, unlinkSync, existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import {
  loadRegistry,
  removeTenantFromRegistry,
  isRegisteredTenant,
} from "./tenant-registry.mjs";
import {
  listTenantTags,
  setTenantYamlInactive,
  checkConfirmation,
  offboardRegistry,
  selectLatestTenantTag,
  tagsToDeleteOnOffboard,
  pruneTenantTagsOnOffboard,
  offboardTenant,
  squashTenantBranch,
} from "./offboard.mjs";
import { assert, assertDeepEqual, finalizeTests } from "./test-utils.mjs";

const PARSER = "node scripts/parse-tenants.mjs";

console.log("Testing offboard.mjs...\n");

function matrixTenants(output) {
  const parsed = JSON.parse(output);
  return parsed.include.map((e) => e.tenant);
}

const TEMP_FILE = "temp-test-offboard.yaml";
const REGISTRY_FILE = "tenants.yaml";
const originalExists = existsSync(REGISTRY_FILE);
let originalContent = null;

try {
  // Registry removal preserves others
  const registry = {
    tenants: [
      { name: "acme-prod", active: true },
      { name: "acme-dev", active: false },
    ],
  };
  const removeResult = removeTenantFromRegistry(registry, "acme-prod");
  assert(removeResult.ok === true, "registry removal returns ok");
  assert(registry.tenants.length === 1, "registry removal removes one tenant");
  assert(registry.tenants[0].name === "acme-dev", "registry removal preserves others");

  // Unknown tenant via removeTenantFromRegistry
  const unknownResult = removeTenantFromRegistry({ tenants: [] }, "missing");
  assert(unknownResult.ok === false, "unknown tenant registry removal fails");

  // Unknown tenant via offboardTenant (full flow, no git)
  writeFileSync(
    TEMP_FILE,
    `tenants:
  - name: acme-prod
    active: true
`
  );
  const unknownOffboard2 = await offboardTenant("missing-tenant", {
    skipGit: true,
    skipConfirmation: true,
    registryFile: TEMP_FILE,
  });
  assert(unknownOffboard2.ok === false, "offboardTenant rejects unknown tenant");
  assert(
    unknownOffboard2.error.includes("missing-tenant"),
    "offboardTenant unknown tenant error mentions name"
  );

  // Tag filter
  const tags = [
    "acme-prod/2025-01-01_00-00-00",
    "acme-prod/2025-01-02_00-00-00",
    "acme-dev/2025-01-01_00-00-00",
    "other-tag",
  ];
  const filtered = listTenantTags(tags, "acme-prod");
  assert(filtered.length === 2, "tag filter returns tenant tags only");
  assert(filtered.every((t) => t.startsWith("acme-prod/")), "tag filter prefix match");

  // Latest tag selection
  assert(
    selectLatestTenantTag(tags, "acme-prod") === "acme-prod/2025-01-02_00-00-00",
    "selectLatestTenantTag picks newest by timestamp"
  );
  assert(selectLatestTenantTag([], "acme-prod") === null, "selectLatestTenantTag returns null for empty list");

  // tagsToDeleteOnOffboard keeps latest, deletes older
  assertDeepEqual(
    tagsToDeleteOnOffboard(tags, "acme-prod"),
    ["acme-prod/2025-01-01_00-00-00"],
    "tagsToDeleteOnOffboard deletes older tags only"
  );

  const singleTag = ["acme-prod/2025-01-02_00-00-00"];
  assertDeepEqual(
    tagsToDeleteOnOffboard(singleTag, "acme-prod"),
    [],
    "tagsToDeleteOnOffboard keeps single tag"
  );
  assertDeepEqual(tagsToDeleteOnOffboard([], "acme-prod"), [], "tagsToDeleteOnOffboard no-op for zero tags");

  const invalidOnly = ["acme-prod/not-a-backup-tag"];
  assert(
    selectLatestTenantTag(invalidOnly, "acme-prod") === null,
    "selectLatestTenantTag ignores invalid backup tag names"
  );
  assertDeepEqual(
    tagsToDeleteOnOffboard(invalidOnly, "acme-prod"),
    invalidOnly,
    "tagsToDeleteOnOffboard deletes invalid tags when no valid latest exists"
  );

  // pruneTenantTagsOnOffboard invokes release delete for deleted tags only
  const tagDeletes = [];
  const releaseDeletes = [];
  const pruneResult = pruneTenantTagsOnOffboard(
    "acme-prod",
    tags,
    (tag) => tagDeletes.push(tag),
    (tag) => releaseDeletes.push(tag)
  );
  assert(pruneResult.kept === "acme-prod/2025-01-02_00-00-00", "pruneTenantTagsOnOffboard keeps latest tag");
  assertDeepEqual(
    tagDeletes,
    ["acme-prod/2025-01-01_00-00-00"],
    "pruneTenantTagsOnOffboard deletes older tenant tags"
  );
  assertDeepEqual(
    releaseDeletes,
    ["acme-prod/2025-01-01_00-00-00"],
    "pruneTenantTagsOnOffboard deletes releases for pruned tags only"
  );

  const noTagDeletes = [];
  const noTagResult = pruneTenantTagsOnOffboard("acme-prod", [], (tag) => noTagDeletes.push(tag));
  assert(noTagResult.kept === null && noTagResult.deleted.length === 0, "pruneTenantTagsOnOffboard no-op when no tags");
  assertDeepEqual(noTagDeletes, [], "pruneTenantTagsOnOffboard does not delete when tag list empty");

  // Squash preserves tree and branch name
  const gitCalls = [];
  const mockGit = (args) => {
    gitCalls.push(args);
    return "";
  };
  writeFileSync(".tenant.yaml", "name: test-tenant\nactive: true\nurl: https://example.com\n");
  try {
    squashTenantBranch("test-tenant", mockGit);
    assert(
      gitCalls.some((c) => c[0] === "checkout" && c[1] === "test-tenant"),
      "squash checks out tenant branch"
    );
    assert(
      gitCalls.some((c) => c[0] === "checkout" && c[1] === "--orphan"),
      "squash creates orphan branch"
    );
    assert(gitCalls.some((c) => c[0] === "add" && c[1] === "-A"), "squash adds full tree");
    assert(
      gitCalls.some((c) => c[0] === "branch" && c[1] === "-M" && c[2] === "test-tenant"),
      "squash preserves tenant branch name"
    );
    assert(
      gitCalls.some((c) => c[0] === "push" && c.includes("--force")),
      "squash force-pushes branch"
    );
  } finally {
    try {
      unlinkSync(".tenant.yaml");
    } catch {
      // ignore
    }
  }

  // setTenantYamlInactive
  const yaml = "name: acme-prod\nactive: true\nurl: https://acme.api.example.com\n";
  const inactiveYaml = setTenantYamlInactive(yaml);
  assert(inactiveYaml.includes("active: false"), "tenant yaml set inactive");

  // Confirmation mismatch via CONFIRM env
  const mismatch = await checkConfirmation("acme-prod", { confirmEnv: "wrong-name" });
  assert(mismatch === false, "confirmation mismatch rejected");

  // Confirmation match via CONFIRM env
  const match = await checkConfirmation("acme-prod", { confirmEnv: "acme-prod" });
  assert(match === true, "confirmation match accepted");

  // --yes skips prompt
  const yesConfirm = await checkConfirmation("acme-prod", { yes: true });
  assert(yesConfirm === true, "--yes skips confirmation prompt");

  // offboardRegistry round-trip
  writeFileSync(
    TEMP_FILE,
    `tenants:
  - name: acme-prod
    active: true
  - name: acme-dev
    active: true
`
  );
  const regResult = offboardRegistry("acme-prod", TEMP_FILE);
  assert(regResult.ok === true, "offboardRegistry succeeds");
  const reloaded = loadRegistry(TEMP_FILE);
  assert(reloaded.tenants.length === 1, "offboardRegistry removes tenant from file");
  assert(reloaded.tenants[0].name === "acme-dev", "offboardRegistry preserves other tenants");

  // Offboarded tenant absent from parse-tenants --all
  if (originalExists) {
    originalContent = readFileSync(REGISTRY_FILE, "utf-8");
    unlinkSync(REGISTRY_FILE);
  }
  writeFileSync(
    REGISTRY_FILE,
    `tenants:
  - name: acme-prod
    active: true
  - name: acme-dev
    active: true
`
  );
  offboardRegistry("acme-prod", REGISTRY_FILE);
  const allTenants = matrixTenants(execSync(`${PARSER} --all`, { encoding: "utf-8" }));
  assert(!allTenants.includes("acme-prod"), "offboarded tenant absent from parser --all output");

  // Offboarded tenant cannot be restore target (mirrors restore.yml tenants.yaml grep)
  const postOffboard = loadRegistry(REGISTRY_FILE);
  assert(
    !isRegisteredTenant(postOffboard, "acme-prod"),
    "offboarded tenant fails restore target validation"
  );
  assert(
    isRegisteredTenant(postOffboard, "acme-dev"),
    "registered tenant passes restore target validation"
  );
} finally {
  try {
    unlinkSync(TEMP_FILE);
  } catch {
    // ignore cleanup errors
  }
  try {
    unlinkSync(REGISTRY_FILE);
  } catch {
    // ignore
  }
  if (originalExists && originalContent !== null) {
    writeFileSync(REGISTRY_FILE, originalContent);
  }
}

finalizeTests();
