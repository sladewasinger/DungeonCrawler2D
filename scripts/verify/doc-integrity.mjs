/** Zero-dependency Markdown freshness, link resolution, README index, and asset hygiene gate. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "artifacts", "playwright-report", "test-results", ".verify-reports", ".scratch"]);
const DOC_PATH_TARGET_DIRS = ["README.md", "AGENTS.md", "docs/LESSONS.md", "docs/VERIFICATION-GATE.md", "docs/ROADMAP.md"];
const EXPLICIT_PATH_RE = /`((?:packages|scripts|docs|tools|e2e|tests|infra)\/[A-Za-z0-9_./-]+\.(?:ts|mjs|js|json|webp|png|md|yml|glsl|py))`/g;
const LINK_RE = /!?\[[^\]]*\]\(([^)]+)\)/g;

const toPosix = (p) => p.split(sep).join("/");

function walkDirEntry(entry, full, out) {
  if (entry.isDirectory()) {
    if (toPosix(relative(ROOT, full)) !== "docs/audit") walkMarkdown(full, out);
  } else if (entry.name.endsWith(".md")) {
    out.push(full);
  }
}

function walkMarkdown(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!IGNORED_DIRS.has(entry.name)) walkDirEntry(entry, resolve(dir, entry.name), out);
  }
  return out;
}

function validateLinkMatch(opts) {
  const target = (opts.rawTarget ?? "").trim().split("#")[0]?.trim() ?? "";
  if (!target || /^(?:https?:|mailto:|#)/i.test(target)) return;
  if (target.startsWith("file://")) { opts.errors.push(`${opts.rel}: machine-specific link '${target}'`); return; }
  if (!existsSync(resolve(dirname(opts.file), target))) opts.errors.push(`${opts.rel}: broken link '${target}'`);
}

function checkMarkdownLinks(mdFiles, errors) {
  for (const file of mdFiles) {
    const rel = toPosix(relative(ROOT, file));
    for (const m of readFileSync(file, "utf8").matchAll(LINK_RE)) {
      validateLinkMatch({ file, rel, rawTarget: m[1], errors });
    }
  }
}

function checkBackticksInFile(file, errors) {
  if (!existsSync(file)) return;
  const rel = toPosix(relative(ROOT, file));
  for (const m of readFileSync(file, "utf8").matchAll(EXPLICIT_PATH_RE)) {
    const candidate = m[1];
    if (candidate && !candidate.includes("*") && !existsSync(resolve(ROOT, candidate))) {
      errors.push(`${rel}: backticked path does not exist '${candidate}'`);
    }
  }
}

function checkBacktickedPaths(mdFiles, errors) {
  const pkgReadmes = mdFiles.filter((f) => /^packages\/.*\/README\.md$/.test(toPosix(relative(ROOT, f))));
  const targets = [...new Set([...DOC_PATH_TARGET_DIRS.map((p) => resolve(ROOT, p)), ...pkgReadmes])];
  for (const file of targets) checkBackticksInFile(file, errors);
}

function collectPackageReadmes(mdFiles) {
  return mdFiles
    .map((f) => toPosix(relative(ROOT, f)))
    .filter((rel) => /^packages\/[^/]+\/src\/.*\/README\.md$/.test(rel));
}

function isIndexedByAncestor(rel, rootDir) {
  const parts = rel.split("/");
  const pkgRootIdx = 2; // packages/<pkg>/...
  for (let i = parts.length - 2; i >= pkgRootIdx; i--) {
    const ancestorDir = parts.slice(0, i).join("/");
    const ancestorReadme = resolve(rootDir, ancestorDir, "README.md");
    if (!existsSync(ancestorReadme)) continue;
    const relFromAncestor = parts.slice(i).join("/");
    const text = readFileSync(ancestorReadme, "utf8");
    if (text.includes(relFromAncestor) || text.includes(`./${relFromAncestor}`)) return true;
  }
  return false;
}

function checkColocatedReadmeLinks(mdFiles, errors) {
  for (const rel of collectPackageReadmes(mdFiles)) {
    if (!isIndexedByAncestor(rel, ROOT)) {
      errors.push(`${rel}: not indexed in its parent or package README.md`);
    }
  }
}

function checkScriptsAndAssets(errors) {
  const pkgJson = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  const docsText = `${readFileSync(resolve(ROOT, "README.md"), "utf8")}\n${readFileSync(resolve(ROOT, "docs/VERIFICATION-GATE.md"), "utf8")}`;
  for (const scriptName of Object.keys(pkgJson.scripts ?? {})) {
    if (!docsText.includes(scriptName)) errors.push(`package.json script '${scriptName}' missing from README.md or VERIFICATION-GATE.md`);
  }
  const spriteManifest = readFileSync(resolve(ROOT, "packages/client/public/assets/sprite-manifest.json"), "utf8");
  const rigMeta = readFileSync(resolve(ROOT, "packages/client/public/assets/player/player-rig.json"), "utf8");
  const combinedManifest = `${spriteManifest}\n${rigMeta}`;
  for (const entry of readdirSync(resolve(ROOT, "packages/client/public/assets"), { withFileTypes: true })) {
    if (entry.isDirectory() && !combinedManifest.includes(`/assets/${entry.name}/`) && entry.name !== "player") {
      errors.push(`packages/client/public/assets/${entry.name}/ is unreferenced by manifests`);
    }
  }
}

function main() {
  const mdFiles = walkMarkdown(ROOT);
  const errors = [];
  checkMarkdownLinks(mdFiles, errors);
  checkBacktickedPaths(mdFiles, errors);
  checkColocatedReadmeLinks(mdFiles, errors);
  checkScriptsAndAssets(errors);
  if (errors.length > 0) {
    for (const err of errors) console.error(`[verify:docs] FAIL: ${err}`);
    process.exit(1);
  }
  console.log(`[verify:docs] PASS (${mdFiles.length} markdown files verified)`);
}

main();
