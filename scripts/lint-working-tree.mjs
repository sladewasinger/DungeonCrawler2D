/** Lint only tracked changes and untracked source files in the working tree. */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";

const sourceFile = /\.(?:[cm]?[jt]sx?)$/;

function splitFiles(output) {
  return String(output ?? "").split(/\r?\n/).filter(Boolean);
}

function gitFiles(args) {
  try {
    return splitFiles(execFileSync("git", args, { encoding: "utf8" }));
  } catch (error) {
    // Some restricted runners attach stdout to an EPERM spawn error even
    // though git completed; retain that output instead of silently linting 0 files.
    return splitFiles(error?.stdout);
  }
}

const candidates = new Set([
  ...gitFiles(["diff", "--name-only", "--diff-filter=ACMRTUXB"]),
  ...gitFiles(["diff", "--cached", "--name-only", "--diff-filter=ACMRTUXB"]),
  ...gitFiles(["ls-files", "--others", "--exclude-standard"]),
]);
const files = [...candidates].filter((file) => existsSync(file) && sourceFile.test(file));

if (files.length === 0) {
  console.log("No changed JavaScript or TypeScript files to lint.");
  process.exit(0);
}

const eslint = process.platform === "win32"
  ? "node_modules/.bin/eslint.cmd"
  : "node_modules/.bin/eslint";
const result = spawnSync(eslint, files, { stdio: "inherit" });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
