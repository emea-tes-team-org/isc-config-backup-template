import { readFileSync } from "fs";
const code = readFileSync("scripts/restore.mjs", "utf-8");
if (code.includes("function batchGitShowFilesAtRef")) {
  console.log("It IS defined!");
} else {
  console.log("It is NOT defined!");
}
