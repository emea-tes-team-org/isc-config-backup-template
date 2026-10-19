import { execSync } from "node:child_process";
import { getPreviousCronTime } from "./scripts/cron-utils.mjs";

const tenant = "axa";
const schedule = "49 7 * * *";
const now = new Date();

function getLatestBackupTime(tenantName) {
  try {
    const output = execSync(
      `git tag -l "${tenantName}/*" --sort=-creatordate --format="%(refname:short)"`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
    );
    const tags = output.trim().split("\n").filter(Boolean);
    if (tags.length === 0) return null;
    const latest = tags[0];
    const match = latest.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
    if (!match) return null;

    const parts = match[1].split(/[_-]/);
    const isoString = `${parts[0]}-${parts[1]}-${parts[2]}T${parts[3]}:${parts[4]}:${parts[5]}Z`;
    return new Date(isoString);
  } catch {
    return null;
  }
}

const latestBackup = getLatestBackupTime(tenant);
console.log("latestBackup:", latestBackup);

let previousCronTime;
try {
  previousCronTime = getPreviousCronTime(schedule, now);
} catch (err) {
  console.log("error parsing cron", err);
}

console.log("previousCronTime:", previousCronTime);
console.log("isPending:", latestBackup === null || latestBackup < previousCronTime);
