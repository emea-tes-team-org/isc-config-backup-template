import fs, {
  writeFileSync,
  readFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import {
  API_VERSION,
  TENANT_NAME,
  authenticate,
  apiCall,
  sleep,
} from "./common.mjs";
import {
  canonicalize,
  stripNoiseFields,
  normalizeExportItem,
} from "./compare-utils.mjs";
import {
  loadRegistry,
  getTenantBackupSettings,
} from "./tenant-registry.mjs";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
export const DEFAULT_POLL_INTERVAL_MS = 10_000;
export const DEFAULT_MAX_EXPORT_ATTEMPTS = 3;
export const RETRYABLE_EXPORT_STATUSES = new Set(["FAILED_EXTERNAL_COMMUNICATION"]);

// ISC's tag-associations service returns a 500 for TAG exports, which aborts
// the whole job and leaves every other type unbacked up. Remove once fixed.
export const SKIPPED_EXPORT_TYPES = new Set(["TAG"]);
import { BACKUP_DIR } from "./backup-path-utils.mjs";

export { BACKUP_DIR };

export class ExportRetryableError extends Error {
  constructor(status, jobId, data) {
    const detail = data?.message ? `: ${data.message}` : "";
    super(`Export status ${status} (job ${jobId})${detail}`);
    this.name = "ExportRetryableError";
    this.status = status;
    this.jobId = jobId;
    this.data = data;
  }
}

export function resolvePollConfig(env = process.env, tenantName = TENANT_NAME) {
  let exportPollMinutes = parseInt(env.EXPORT_POLL_MINUTES || "", 10);
  if (!Number.isFinite(exportPollMinutes)) {
    exportPollMinutes = getTenantBackupSettings(loadRegistry(), tenantName).exportPollMinutes;
  }

  const pollIntervalMs = parseInt(env.POLL_INTERVAL_MS || "", 10) || DEFAULT_POLL_INTERVAL_MS;
  let maxExportAttempts = parseInt(env.MAX_EXPORT_ATTEMPTS || "", 10);
  if (!Number.isFinite(maxExportAttempts) || maxExportAttempts < 1) {
    maxExportAttempts = DEFAULT_MAX_EXPORT_ATTEMPTS;
  }

  const maxPollAttempts = Math.max(
    1,
    Math.ceil((exportPollMinutes * 60_000) / pollIntervalMs)
  );

  return { exportPollMinutes, maxExportAttempts, maxPollAttempts, pollIntervalMs };
}

// ---------------------------------------------------------------------------
// Step 1: Fetch exportable object types
// ---------------------------------------------------------------------------
async function getExportableTypes() {
  console.log("Fetching exportable object types...");

  const data = await apiCall(
    "GET",
    `/${API_VERSION}/sp-config/config-objects?filters=exportable%20eq%20%22true%22`
  );

  const allTypes = [...new Set(data.map((obj) => obj.objectType))];
  const types = allTypes.filter((type) => !SKIPPED_EXPORT_TYPES.has(type));
  const skipped = allTypes.filter((type) => SKIPPED_EXPORT_TYPES.has(type));

  console.log(`Found ${types.length} exportable types: ${types.join(", ")}`);
  if (skipped.length > 0) {
    console.log(`Skipping known-broken types: ${skipped.join(", ")}`);
  }
  return types;
}

// ---------------------------------------------------------------------------
// Step 2: Create export job
// ---------------------------------------------------------------------------
async function createExport(includeTypes) {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`Creating export (${today})...`);

  const data = await apiCall("POST", `/${API_VERSION}/sp-config/export`, {
    description: `Daily backup ${today}`,
    includeTypes,
  });

  const jobId = data.jobId;
  console.log(`Export job created: ${jobId}`);
  return jobId;
}

// ---------------------------------------------------------------------------
// Step 3: Poll until the export job is COMPLETE
// ---------------------------------------------------------------------------
export async function pollExport(jobId, options, deps = { apiCall, sleep }) {
  const { maxPollAttempts, pollIntervalMs } = options;
  console.log(
    `Polling export status (budget: ${maxPollAttempts} attempts @ ${pollIntervalMs / 1000}s)...`
  );

  for (let attempt = 1; attempt <= maxPollAttempts; attempt++) {
    const data = await deps.apiCall(
      "GET",
      `/${API_VERSION}/sp-config/export/${jobId}`
    );
    const status = data.status;
    console.log(
      `  Status: ${status} (attempt ${attempt}/${maxPollAttempts})`
    );

    if (status === "COMPLETE") {
      console.log("  Export complete.");
      return data;
    }
    if (status === "FAILED") {
      throw new Error(`Export failed:\n${JSON.stringify(data, null, 2)}`);
    }
    if (status === "CANCELLED") {
      throw new Error("Export was cancelled");
    }
    if (RETRYABLE_EXPORT_STATUSES.has(status)) {
      throw new ExportRetryableError(status, jobId, data);
    }

    await deps.sleep(pollIntervalMs);
  }

  throw new Error(
    `Export timed out after ${(maxPollAttempts * pollIntervalMs) / 1000} seconds`
  );
}

export async function runExportWithRetries(includeTypes, options, deps = { apiCall, sleep, createExport }) {
  const { maxExportAttempts, maxPollAttempts, pollIntervalMs } = options;
  const failedJobIds = [];

  for (let exportAttempt = 1; exportAttempt <= maxExportAttempts; exportAttempt++) {
    console.log(`Export attempt ${exportAttempt}/${maxExportAttempts}...`);
    const jobId = await deps.createExport(includeTypes);

    try {
      await pollExport(jobId, { maxPollAttempts, pollIntervalMs }, deps);
      if (failedJobIds.length > 0) {
        console.log(
          `Export succeeded on attempt ${exportAttempt} after retrying (previous job IDs: ${failedJobIds.join(", ")})`
        );
      }
      return jobId;
    } catch (err) {
      if (err instanceof ExportRetryableError) {
        // The job payload carries the underlying cause (e.g. an unsupported
        // object type). Without it, the status alone is not diagnosable.
        console.log(`  Job details: ${JSON.stringify(err.data)}`);

        if (exportAttempt < maxExportAttempts) {
          failedJobIds.push(err.jobId);
          console.log(
            `Retryable export failure (${err.status}) for job ${err.jobId}; creating new export...`
          );
          continue;
        }
      }
      throw err;
    }
  }

  throw new Error("Export failed after exhausting all export attempts");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a set of all existing backup file paths (relative to BACKUP_DIR)
 * so we can detect deletions after the download completes.
 */
function collectExistingFiles(dir) {
  const existing = new Set();
  if (!existsSync(dir)) return existing;

  for (const typeName of readdirSync(dir, { withFileTypes: true })) {
    if (!typeName.isDirectory()) continue;
    const typeDir = join(dir, typeName.name);
    for (const file of readdirSync(typeDir, { withFileTypes: true })) {
      if (file.isFile()) {
        existing.add(join(typeName.name, file.name));
      }
    }
  }
  return existing;
}

// ---------------------------------------------------------------------------
// Step 4: Download export and write individual object files
// ---------------------------------------------------------------------------

async function processExportItem(item, backupDir, seenFiles) {
  const objectType = item.self?.type;
  const objectId = item.self?.id;

  if (!objectType || !objectId) {
    console.warn("  Skipping item with missing self.type / self.id:", item);
    return { status: "skipped" };
  }

  const typeDir = join(backupDir, objectType);
  await fs.promises.mkdir(typeDir, { recursive: true }).catch(() => {});

  const itemWithJws = normalizeExportItem(item);
  const newContent = JSON.stringify(canonicalize(itemWithJws), null, 2) + "\n";

  const relPath = join(objectType, `${objectId}.json`);
  const filePath = join(backupDir, relPath);
  seenFiles.add(relPath);

  let existingNormalized = null;
  try {
    const existingContent = await fs.promises.readFile(filePath, "utf8");
    existingNormalized = existingContent.replace(/\r\n/g, "\n");
  } catch (err) {
    // Does not exist or cannot be read
  }

  if (newContent !== existingNormalized) {
    if (existingNormalized !== null) {
      const strippedNew = JSON.stringify(canonicalize(stripNoiseFields(itemWithJws)), null, 2) + "\n";
      const strippedExisting =
        JSON.stringify(
          canonicalize(stripNoiseFields(normalizeExportItem(JSON.parse(existingNormalized)))),
          null,
          2
        ) + "\n";
      if (strippedNew === strippedExisting) {
        return { status: "noise-only" };
      }
    }

    await fs.promises.writeFile(filePath, newContent);
    return { status: "written" };
  }

  return { status: "unchanged" };
}

function removeDeletedFiles(backupDir, existingFiles, seenFiles) {
  let deletedCount = 0;
  for (const relPath of existingFiles) {
    if (!seenFiles.has(relPath)) {
      rmSync(join(backupDir, relPath));
      console.log(`  Removed deleted object: ${relPath}`);
      deletedCount++;
    }
  }
  return deletedCount;
}

function removeEmptyDirectories(backupDir) {
  if (existsSync(backupDir)) {
    for (const entry of readdirSync(backupDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const typeDir = join(backupDir, entry.name);
        if (readdirSync(typeDir).length === 0) {
          rmSync(typeDir, { recursive: true });
        }
      }
    }
  }
}

async function downloadObjects(jobId) {
  console.log("Downloading export...");

  const response = await apiCall(
    "GET",
    `/${API_VERSION}/sp-config/export/${jobId}/download`
  );

  const items = response?.objects;
  if (!Array.isArray(items)) {
    throw new Error(
      `Unexpected download response — no 'objects' array found.\n` +
        JSON.stringify(response, null, 2).slice(0, 500)
    );
  }

  console.log(`  Export contains ${items.length} objects`);

  const existingFiles = collectExistingFiles(BACKUP_DIR);
  const seenFiles = new Set();

  let totalCount = 0;
  let writtenCount = 0;
  let noiseOnlyCount = 0;

  const results = await Promise.all(
    items.map(item => processExportItem(item, BACKUP_DIR, seenFiles))
  );

  for (const { status } of results) {
    if (status !== "skipped") {
      totalCount++;
    }
    if (status === "written") {
      writtenCount++;
    } else if (status === "noise-only") {
      noiseOnlyCount++;
    }
  }

  const deletedCount = removeDeletedFiles(BACKUP_DIR, existingFiles, seenFiles);
  removeEmptyDirectories(BACKUP_DIR);

  console.log(
    `Processed ${totalCount} objects: ${writtenCount} updated, ` +
      `${noiseOnlyCount} noise-only skipped, ` +
      `${deletedCount} deleted, ${totalCount - writtenCount - noiseOnlyCount - deletedCount} unchanged`
  );
  return totalCount;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const pollConfig = resolvePollConfig();
  console.log("=== ISC Configuration Backup ===");
  console.log(`Tenant: ${TENANT_NAME}`);
  console.log(`Backup directory: ${BACKUP_DIR}`);
  console.log(
    `Export poll budget: ${pollConfig.exportPollMinutes} minutes (${pollConfig.maxPollAttempts} attempts)`
  );
  console.log(`Max export attempts: ${pollConfig.maxExportAttempts}`);
  console.log();

  await authenticate();

  const types = await getExportableTypes();
  const jobId = await runExportWithRetries(types, pollConfig, {
    apiCall,
    sleep,
    createExport,
  });

  await authenticate();
  await downloadObjects(jobId);

  console.log();
  console.log("=== Backup complete! ===");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("FATAL:", err.message || err);
    process.exit(1);
  });
}
