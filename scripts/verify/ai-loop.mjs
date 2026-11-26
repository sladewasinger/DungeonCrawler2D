/** Fast (<4s) incremental AI feedback loop:Changed ESLint + folder check + docs + related Vitest tests + JSON report. */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SOURCE_RE = /\.(?:[cm]?[jt]sx?)$/;
const DOC_OR_CODE_RE = /\.(?:[cm]?[jt]sx?|py|md)$/;

function gitLines(args) {
  try {
    return String(execFileSync("git", args, { cwd: ROOT, encoding: "utf8" })).split(/\r?\n/).filter(Boolean);
  } catch (err) {
    return String(err?.stdout ?? "").split(/\r?\n/).filter(Boolean);
  }
}

function listChangedFiles() {
  const all = new Set([
    ...gitLines(["diff", "--name-only", "--diff-filter=ACMRTUXB"]),
    ...gitLines(["diff", "--cached", "--name-only", "--diff-filter=ACMRTUXB"]),
    ...gitLines(["ls-files", "--others", "--exclude-standard"]),
  ]);
  return [...all].filter((f) => existsSync(resolve(ROOT, f)));
}

function runStep(name, cmd, args) {
  const t0 = performance.now();
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", shell: false });
  const durationMs = Math.round(performance.now() - t0);
  const ok = res.status === 0;
  const output = `${res.stdout ?? ""}\n${res.stderr ?? ""}`.trim();
  return { name, ok, durationMs, summary: ok ? "PASS" : "FAIL", output: ok ? "" : output.slice(-2_000) };
}

function touchedTypecheckWorkspaces(files) {
  const pkgs = new Set();
  for (const f of files) {
    const m = /^packages\/([^/]+)\//.exec(f);
    if (m && existsSync(resolve(ROOT, `packages/${m[1]}/tsconfig.json`))) pkgs.add(m[1]);
  }
  return [...pkgs];
}

function collectLoopSteps(changed, jsTsFiles) {
  const steps = [];
  if (jsTsFiles.length > 0) {
    steps.push(runStep("eslint-changed", process.execPath, ["node_modules/eslint/bin/eslint.js", ...jsTsFiles]));
  }
  if (changed.some((f) => DOC_OR_CODE_RE.test(f))) {
    steps.push(runStep("folder-size-changed", process.execPath, ["scripts/check-folder-size.mjs", "--changed"]));
  }
  steps.push(runStep("verify-docs", process.execPath, ["scripts/verify/doc-integrity.mjs"]));
  for (const pkg of touchedTypecheckWorkspaces(jsTsFiles)) {
    steps.push(runStep(`tsc-${pkg}`, process.execPath, ["node_modules/typescript/bin/tsc", "-p", `packages/${pkg}/tsconfig.json`, "--noEmit"]));
  }
  if (jsTsFiles.length > 0) {
    steps.push(runStep("vitest-related", process.execPath, ["node_modules/vitest/vitest.mjs", "related", "--run", "--passWithNoTests", ...jsTsFiles]));
  }
  return steps;
}

function main() {
  const start = performance.now();
  const changed = listChangedFiles();
  const steps = collectLoopSteps(changed, changed.filter((f) => SOURCE_RE.test(f)));
  const durationMs = Math.round(performance.now() - start);
  const ok = steps.every((s) => s.ok);
  mkdirSync(resolve(ROOT, ".verify-reports"), { recursive: true });
  writeFileSync(resolve(ROOT, ".verify-reports/ai-feedback.json"), JSON.stringify({
    mode: "ai:loop", ok, durationMs, changedFiles: changed, steps, timestamp: new Date().toISOString(),
  }, null, 2), "utf8");
  for (const s of steps) {
    console.log(`[ai:loop] ${s.summary} ${s.name} (${s.durationMs}ms)`);
    if (!s.ok && s.output) console.error(s.output);
  }
  console.log(`[ai:loop] ${ok ? "PASS" : "FAIL"} in ${durationMs}ms`);
  if (!ok) process.exit(1);
}

main();
