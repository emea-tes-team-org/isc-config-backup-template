#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for workflow file references — consolidated six-workflow roster.
//
// Usage: node scripts/test-workflow-references.mjs
// ---------------------------------------------------------------------------

import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { assert, finalizeTests } from "./test-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const workflowsDir = resolve(root, ".github/workflows");

function readWorkflow(name) {
  return readFileSync(resolve(workflowsDir, name), "utf-8");
}

console.log("Testing workflow file references...\n");

const operatorWorkflows = [
  "isc-lifecycle.yml",
  "isc-backup.yml",
  "isc-restore.yml",
  "isc-config-tools.yml",
  "scheduled-backup.yml",
  "isc-maintenance.yml",
];

for (const file of operatorWorkflows) {
  assert(existsSync(resolve(workflowsDir, file)), `${file}: exists`);
}

const superseded = [
  "sync-workflows.yml",
  "onboarding.yml",
  "backup.yml",
  "restore.yml",
  "schedule-toggle.yml",
  "offboard.yml",
  "tokenize.yml",
  "drift-detection.yml",
  "dashboard.yml",
  "prune-tags.yml",
  "cleanup-deployments.yml",
  "re-register-tenant.yml",
  "re-register-all-tenants.yml",
];

for (const file of superseded) {
  assert(!existsSync(resolve(workflowsDir, file)), `${file}: removed`);
}

// At most six operator workflows (+ optional cleanup-tenant-workflows.yml
// and generated per-tenant dispatch shortcuts)
{
  const all = readdirSync(workflowsDir).filter((f) => f.endsWith(".yml"));
  const nonOperator = ["cleanup-tenant-workflows.yml"];
  const isTenantShortcut = (file) =>
    /^isc-(backup|toggle|verify|offboard)-.+\.yml$/.test(file);
  const operatorCount = all.filter(
    (f) => !nonOperator.includes(f) && !isTenantShortcut(f)
  ).length;
  assert(operatorCount === 6, `exactly six operator workflows (found ${operatorCount})`);
}

const backupWorkflows = ["isc-backup.yml", "scheduled-backup.yml"];

for (const file of backupWorkflows) {
  const content = readWorkflow(file);
  assert(!content.includes("backup-stats.sh"), `${file}: no backup-stats.sh reference`);
  assert(content.includes("generate-backup-stats.mjs"), `${file}: uses generate-backup-stats.mjs`);
  assert(content.includes("create-backup-tag.sh"), `${file}: creates restore-point tags`);
  assert(content.includes("create-backup-release.sh"), `${file}: publishes GitHub Release on backup tag`);
  assert(content.includes("Publish backup release"), `${file}: has Publish backup release step`);
  assert(content.includes("deployments: write"), `${file}: grants deployments write`);
  assert(
    content.includes("Remove ephemeral deployment trace"),
    `${file}: cleans up deployment trace`
  );
  assert(
    /cleanup-deployment:[\s\S]*?permissions:[\s\S]*?contents: read[\s\S]*?deployments: write/.test(content),
    `${file}: cleanup job grants contents: read and deployments: write`
  );
  assert(
    /cleanup-deployment:[\s\S]*?contents\/scripts\/cleanup-deployment\.sh\?ref=main/.test(content),
    `${file}: cleanup job fetches helper via GitHub API (no checkout)`
  );
}

const scheduledBackup = readWorkflow("scheduled-backup.yml");
const iscBackup = readWorkflow("isc-backup.yml");
assert(scheduledBackup.includes("name: Scheduled Backup"), "scheduled-backup.yml: display name");
assert(scheduledBackup.includes("generate-readme.mjs"), "scheduled-backup.yml: regenerates README.md");
assert(scheduledBackup.includes("git fetch origin --tags"), "scheduled-backup.yml: fetches backup tags before README");
assert(iscBackup.includes("generate-readme.mjs"), "isc-backup.yml: regenerates README.md");
assert(
  scheduledBackup.includes("backup-dashboard-${{ github.run_id }}"),
  "scheduled-backup.yml: uploads dashboard artifact"
);
assert(
  !scheduledBackup.includes("generate-dashboard.mjs > DASHBOARD.md"),
  "scheduled-backup.yml: no standalone DASHBOARD.md generation"
);

const lifecycle = readWorkflow("isc-lifecycle.yml");
assert(lifecycle.includes("operation:"), "isc-lifecycle.yml: operation input");
assert(lifecycle.includes("onboard.mjs --from-env --push-registry"), "isc-lifecycle.yml: onboard script");
assert(lifecycle.includes("scripts/cli.mjs verify"), "isc-lifecycle.yml: verify via CLI");
assert(lifecycle.includes("schedule-toggle"), "isc-lifecycle.yml: schedule-toggle operation");
assert(lifecycle.includes("confirm_tenant"), "isc-lifecycle.yml: offboard confirmation");
assert(
  lifecycle.includes("must be run from the main branch") || lifecycle.includes("must run on main"),
  "isc-lifecycle.yml: main-branch guard"
);

const restore = readWorkflow("isc-restore.yml");
assert(restore.includes("source_ref:"), "isc-restore.yml: source_ref input");
assert(
  restore.includes('github.ref_name }}" != "main"') || restore.includes("must be run from the main branch"),
  "isc-restore.yml: main-only guard"
);
assert(
  !restore.includes('SOURCE_REF="${{ github.ref_name }}"'),
  "isc-restore.yml: does not use workflow trigger ref as source"
);

const configTools = readWorkflow("isc-config-tools.yml");
assert(configTools.includes("tokenize"), "isc-config-tools.yml: tokenize operation");
assert(configTools.includes("drift-detection"), "isc-config-tools.yml: drift-detection operation");

const maintenance = readWorkflow("isc-maintenance.yml");
assert(maintenance.includes("prune-tags.mjs"), "isc-maintenance.yml: prune-tags");
assert(maintenance.includes("cleanup-deployments.mjs"), "isc-maintenance.yml: cleanup-deployments");
assert(
  /cleanup-sync-deployment:[\s\S]*?permissions:[\s\S]*?contents: read[\s\S]*?deployments: write/.test(maintenance),
  "isc-maintenance.yml: sync cleanup job grants contents: read and deployments: write"
);
assert(
  /cleanup-sync-deployment:[\s\S]*?contents\/scripts\/cleanup-deployment\.sh\?ref=main/.test(maintenance),
  "isc-maintenance.yml: sync cleanup fetches helper via GitHub API"
);
assert(
  maintenance.includes("0 3 * * 0"),
  "isc-maintenance.yml: weekly cron"
);

assert(existsSync(resolve(root, "README.template.md")), "README.template.md exists");

finalizeTests();
