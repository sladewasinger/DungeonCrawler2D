/** Enforce the direct-file limit for feature folders, with a migration baseline. */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import process from "node:process";

const MAX_DIRECT_FILES = 12;
const ROOT = process.cwd();
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/;
const ROOTS = ["packages", "scripts", "tests", "tools"];
const BASELINE = JSON.parse(readFileSync(new URL("./folder-size-baseline.json", import.meta.url), "utf8"));

function collectFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", "build", ".vite", "coverage"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) collectFiles(path, files);
    else if (SOURCE_FILE.test(entry.name)) files.push(path);
  }
  return files;
}

function countsByDirectory() {
  const counts = new Map();
  for (const root of ROOTS) {
    const directory = resolve(ROOT, root);
    if (!existsSync(directory)) continue;
    for (const file of collectFiles(directory)) {
      const relativeDirectory = relative(ROOT, resolve(file, ".."));
      counts.set(relativeDirectory, (counts.get(relativeDirectory) ?? 0) + 1);
    }
  }
  return counts;
}

function changedDirectories() {
  const output = [
    "diff --name-only --diff-filter=ACMRTUXB",
    "diff --cached --name-only --diff-filter=ACMRTUXB",
    "ls-files --others --exclude-standard",
  ].flatMap((command) => {
    try {
      return String(execFileSync("git", command.split(" "), { encoding: "utf8" }))
        .split(/\r?\n/).filter(Boolean);
    } catch (error) {
      return String(error?.stdout ?? "").split(/\r?\n/).filter(Boolean);
    }
  });
  return new Set(output
    .filter((file) => SOURCE_FILE.test(file))
    .map((file) => relative(ROOT, resolve(ROOT, file, ".."))));
}

const changedOnly = process.argv.includes("--changed");
const current = countsByDirectory();
const directories = changedOnly ? changedDirectories() : new Set(current.keys());
const errors = [];
const legacy = [];

for (const directory of directories) {
  const count = current.get(directory) ?? 0;
  if (count <= MAX_DIRECT_FILES) continue;
  const baselineCount = BASELINE[directory];
  if (baselineCount === undefined || count > baselineCount) {
    errors.push(`${directory}: ${count} direct source files (limit ${MAX_DIRECT_FILES})`);
  } else {
    legacy.push(`${directory}: ${count} (baseline ${baselineCount})`);
  }
}

if (legacy.length > 0) {
  console.warn(`Folder-size check: ${legacy.length} legacy oversized folder(s) remain; do not grow them.`);
  for (const directory of legacy) console.warn(`  ${directory}`);
}
if (errors.length > 0) {
  console.error("Folder-size check failed. Split the folder into feature-slice subfolders:");
  for (const directory of errors) console.error(`  ${directory}`);
  process.exit(1);
}
