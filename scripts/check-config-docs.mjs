#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = new Set([".cjs", ".js", ".json", ".jsx", ".mjs", ".ts", ".tsx"]);
const SCAN_DIRECTORIES = ["packages", "scripts", "tools"];
const ROOT_SOURCE_FILES = ["package.json"];
const OMIT_DIRECTORIES = new Set(["dist", "node_modules"]);
const BUILT_IN_VITE_KEYS = new Set(["BASE_URL", "DEV", "MODE", "PROD", "SSR"]);
const DOC_START = "<!-- config-environment:start -->";
const DOC_END = "<!-- config-environment:end -->";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (OMIT_DIRECTORIES.has(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

function configuredNames(source) {
  const names = new Set();
  const processPattern = /process\.env(?:\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\]|\.([A-Z][A-Z0-9_]*))/g;
  const vitePattern = /\bVITE_[A-Z][A-Z0-9_]*\b/g;
  const importMetaPattern = /import\.meta\.env\.([A-Z][A-Z0-9_]*)/g;
  for (const match of source.matchAll(processPattern)) names.add(match[1] ?? match[2]);
  for (const match of source.matchAll(vitePattern)) names.add(match[0]);
  for (const match of source.matchAll(importMetaPattern)) {
    if (!BUILT_IN_VITE_KEYS.has(match[1])) names.add(match[1]);
  }
  return names;
}

function documentedNames(readme) {
  const start = readme.indexOf(DOC_START);
  const end = readme.indexOf(DOC_END);
  if (start < 0 || end <= start) throw new Error("README configuration markers are missing or out of order");
  const section = readme.slice(start, end);
  return new Set([...section.matchAll(/\|\s*`([A-Z][A-Z0-9_]*)`\s*\|/g)].map((match) => match[1]));
}

async function main() {
  const nestedPaths = await Promise.all(SCAN_DIRECTORIES.map((directory) =>
    sourceFiles(resolve(repositoryRoot, directory))));
  const paths = [...ROOT_SOURCE_FILES.map((path) => resolve(repositoryRoot, path)), ...nestedPaths.flat()];
  const configured = new Set();
  for (const path of paths) {
    const source = await readFile(path, "utf8");
    for (const name of configuredNames(source)) configured.add(name);
  }
  const readme = await readFile(resolve(repositoryRoot, "README.md"), "utf8");
  const documented = documentedNames(readme);
  const missing = [...configured].filter((name) => !documented.has(name)).sort();
  if (missing.length === 0) {
    console.log(`configuration docs cover ${configured.size} server/Vite variables`);
    return;
  }
  console.error(`README configuration reference is missing: ${missing.join(", ")}`);
  console.error(`Add each variable as a table row between ${DOC_START} and ${DOC_END}.`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
