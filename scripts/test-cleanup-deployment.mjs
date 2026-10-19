#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Tests for cleanup-deployment.sh and cleanup-deployments.mjs
//
// Usage: node scripts/test-cleanup-deployment.mjs
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deleteDeploymentRecord,
  listDeployments,
  sweepDeployments,
} from "./cleanup-deployments.mjs";
import { assert, finalizeTests } from "./test-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const shellScript = join(root, "scripts/cleanup-deployment.sh");

console.log("Testing deployment cleanup...\n");

function runShell(envName, mockGhScript, extraEnv = {}) {
  const binDir = mkdtempSync(join(tmpdir(), "mock-gh-bin-"));
  const ghPath = join(binDir, "gh");
  writeFileSync(ghPath, mockGhScript, { mode: 0o755 });
  return execFileSync("bash", [shellScript, envName], {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      GITHUB_REPOSITORY: "org/repo",
      GH_TOKEN: "test-token",
      ...extraEnv,
    },
  });
}

// cleanup-deployment.sh deletes all deployments for environment
{
  const output = runShell(
    "acme-prod",
    `#!/usr/bin/env bash
STATE="/tmp/mock-deploy-state-acme-prod"
echo "999 888" > "$STATE"
if [[ "$1" == "api" && "$2" == repos/*deployments?environment=acme-prod* ]]; then
  ids=$(cat "$STATE" | xargs)
  if [[ -z "$ids" ]]; then
    echo ""
    exit 0
  fi
  echo "$ids" | tr " " "\\n"
  exit 0
fi
if [[ "$1" == "api" && "$2" == "-X" && "$3" == "POST" && "$4" == repos/*/deployments/*/statuses ]]; then
  exit 0
fi
if [[ "$1" == "api" && "$2" == "-X" && "$3" == "DELETE" && "$4" == repos/*/deployments/* ]]; then
  id="\${4##*/}"
  remaining=$(cat "$STATE" | tr " " "\\n" | grep -vx "$id" | tr "\\n" " " | xargs)
  echo "$remaining" > "$STATE"
  exit 0
fi
echo "unexpected: $*" >&2
exit 1
`
  );
  assert(output.includes("Deleted deployment 999"), "shell script deletes listed deployments");
  assert(output.includes("Deleted deployment 888"), "shell script deletes every listed deployment");
}

// cleanup-deployment.sh no-op when no deployment exists
{
  const output = runShell(
    "acme-prod",
    `#!/usr/bin/env bash
if [[ "$1" == "api" ]]; then
  echo ""
  exit 0
fi
exit 1
`
  );
  assert(output.includes("nothing to clean up"), "shell script no-op when list empty");
}

// cleanup-deployment.sh DRY_RUN skips delete
{
  const binDir = mkdtempSync(join(tmpdir(), "dry-run-gh-"));
  const ghPath = join(binDir, "gh");
  writeFileSync(
    ghPath,
    `#!/usr/bin/env bash
if [[ "$1" == "api" && "$2" == repos/*deployments?environment=acme-prod* ]]; then
  echo "42"
  exit 0
fi
if [[ "$2" == "-X" && "$3" == "DELETE" ]]; then
  echo delete >&2
  exit 1
fi
exit 0
`,
    { mode: 0o755 }
  );
  const output = execFileSync("bash", [shellScript, "acme-prod"], {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      GITHUB_REPOSITORY: "org/repo",
      DRY_RUN: "1",
    },
  });
  assert(output.includes("Would delete deployment 42"), "shell script DRY_RUN lists without delete");
}

// cleanup-deployment.sh delete failure is non-fatal
{
  const output = runShell(
    "acme-prod",
    `#!/usr/bin/env bash
if [[ "$1" == "api" && "$2" == repos/*deployments?environment=acme-prod* ]]; then
  echo "7"
  exit 0
fi
if [[ "$2" == "-X" && "$3" == "DELETE" ]]; then
  echo "HTTP 403" >&2
  exit 1
fi
exit 0
`
  );
  assert(output.includes("Could not delete deployment 7"), "shell script warns on delete failure");
}

// listDeployments paginates through all pages
{
  let page = 0;
  const ghRunner = (args) => {
    if (args[0] === "api" && args[1].includes("deployments?")) {
      page += 1;
      if (page === 1) {
        return "1\tacme-prod\t2026-08-12T00:00:00Z\tmain\n2\tacme-prod\t2026-08-12T01:00:00Z\tmain\n";
      }
      return "";
    }
    return "";
  };
  const rows = listDeployments("org/repo", { perPage: 2 }, ghRunner);
  assert(rows.length === 2, "listDeployments paginates until a short page");
  assert(page === 2, "listDeployments requests a second page when first page is full");
}

// listDeployments parses gh api TSV output
{
  const ghRunner = () => "100\tacme-prod\t2026-08-12T00:00:00Z\tmain\n101\taxa\t2026-08-12T01:00:00Z\tmain\n";
  const rows = listDeployments("org/repo", {}, ghRunner);
  assert(rows.length === 2, "listDeployments returns parsed rows");
  assert(rows[0].id === 100 && rows[0].environment === "acme-prod", "listDeployments parses id and environment");
}

// sweepDeployments dry-run does not delete
{
  let deleteCalls = 0;
  const ghRunner = (args) => {
    if (args[0] === "api" && args[1].startsWith("repos/org/repo/deployments?")) {
      return "55\tacme-prod\t2026-08-12T00:00:00Z\tmain\n";
    }
    if (args[2] === "DELETE") {
      deleteCalls += 1;
    }
    return "";
  };
  const result = sweepDeployments({
    repo: "org/repo",
    environment: "acme-prod",
    dryRun: true,
    ghRunner,
  });
  assert(result.listed === 1 && result.deleted === 0, "sweep dry-run lists without deleting");
  assert(deleteCalls === 0, "sweep dry-run makes no delete API calls");
}

// sweepDeployments deletes each listed deployment
{
  const calls = [];
  const ghRunner = (args) => {
    if (args[0] === "api" && args[1].includes("deployments?")) {
      return "10\tacme-prod\t2026-08-12T00:00:00Z\tmain\n20\tacme-prod\t2026-08-11T00:00:00Z\tmain\n";
    }
    calls.push(args.join(" "));
    return "";
  };
  const result = sweepDeployments({
    repo: "org/repo",
    environment: "acme-prod",
    dryRun: false,
    ghRunner,
  });
  assert(result.deleted === 2, "sweep deletes all listed deployments");
  assert(
    calls.some((call) => call.includes("DELETE") && call.includes("/deployments/10")),
    "sweep deletes first deployment id"
  );
}

// deleteDeploymentRecord ignores 404
{
  const ghRunner = (args) => {
    if (args[2] === "DELETE") {
      const err = new Error("Not Found");
      err.stderr = "HTTP 404: Not Found";
      throw err;
    }
    return "";
  };
  const deleted = deleteDeploymentRecord("org/repo", 404, ghRunner);
  assert(deleted === false, "deleteDeploymentRecord ignores missing deployment");
}

finalizeTests();
