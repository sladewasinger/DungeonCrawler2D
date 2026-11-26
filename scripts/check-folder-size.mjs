/** Enforce direct-file limits and colocated README.md coverage for feature folders. */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import process from "node:process";

const toBaselineKey = (directory) => directory.split(sep).join("/");

const MAX_DIRECT_FILES = 12;
const MIN_FILES_FOR_README = 3;
const ROOT = process.cwd();
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|py)$/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const ROOTS = ["packages", "scripts", "tests", "tools"];
const BASELINE = JSON.parse(readFileSync(new URL("./folder-size-baseline.json", import.meta.url), "utf8"));
const IGNORED_DIRECTORIES = new Set(["node_modules", "dist", "build", ".vite", "coverage"]);

function collectFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    collectEntry(directory, entry, files);
  }
  return files;
}

function collectEntry(directory, entry, files) {
  if (IGNORED_DIRECTORIES.has(entry.name)) return;
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) {
    collectFiles(path, files);
    return;
  }
  if (SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) files.push(path);
}

function countsByDirectory() {
  const counts = new Map();
  for (const root of ROOTS) {
    const directory = resolve(ROOT, root);
    if (!existsSync(directory)) continue;
    for (const file of collectFiles(directory)) {
      const relativeDirectory = toBaselineKey(relative(ROOT, resolve(file, "..")));
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
    .filter((file) => SOURCE_FILE.test(file) && !TEST_FILE.test(file))
    .map((file) => toBaselineKey(relative(ROOT, resolve(ROOT, file, "..")))));
}

function hasParentReadmeCovering(relDir) {
  const parts = relDir.split("/");
  const folderName = parts[parts.length - 1];
  const parentDir = parts.slice(0, -1).join("/");
  if (!parentDir || parentDir.endsWith("/src")) return false;
  const parentReadme = resolve(ROOT, parentDir, "README.md");
  if (!existsSync(parentReadme)) return false;
  return readFileSync(parentReadme, "utf8").toLowerCase().includes(folderName.toLowerCase());
}

function findMissingReadmeError(relDir, count) {
  if (count < MIN_FILES_FOR_README) return null;
  if (!/^packages\/[^/]+\/src(?:\/.+)?$/.test(relDir)) return null;
  if (existsSync(resolve(ROOT, relDir, "README.md"))) return null;
  if (hasParentReadmeCovering(relDir)) return null;
  return `${relDir}: ${count} prod files without colocated README.md (or parent README index)`;
}

const changedOnly = process.argv.includes("--changed");
const current = countsByDirectory();
const directories = changedOnly ? changedDirectories() : new Set(current.keys());
const errors = [];
const legacy = [];

for (const directory of directories) {
  const count = current.get(directory) ?? 0;
  const readmeErr = findMissingReadmeError(directory, count);
  if (readmeErr) errors.push(readmeErr);
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
  console.error("Folder-size & colocated-docs check failed:");
  for (const directory of errors) console.error(`  ${directory}`);
  process.exit(1);
}
