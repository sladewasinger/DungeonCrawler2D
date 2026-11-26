/** Master phase gate runner executing all verification layers sequentially and writing ai-feedback.json. */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const NPM_CMD = process.platform === "win32" ? "npm.cmd" : "npm";
const stepsReport = [];

function writeFeedback(ok, totalMs) {
  mkdirSync(resolve(ROOT, ".verify-reports"), { recursive: true });
  writeFileSync(resolve(ROOT, ".verify-reports/ai-feedback.json"), JSON.stringify({
    mode: "ai:gate", ok, durationMs: Math.round(totalMs), steps: stepsReport, timestamp: new Date().toISOString(),
  }, null, 2), "utf8");
}

function runStep(opts) {
  console.log(`\n=== [verify:phase] ${opts.label} ===`);
  const t0 = performance.now();
  const res = spawnSync(opts.cmd, opts.args, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
  const ok = res.status === 0;
  stepsReport.push({ name: opts.label, ok, durationMs: Math.round(performance.now() - t0), summary: ok ? "PASS" : "FAIL" });
  if (!ok) {
    writeFeedback(false, performance.now() - opts.startMs);
    console.error(`\n[verify:phase] FAILED at step: ${opts.label}`);
    process.exit(res.status ?? 1);
  }
}

function main() {
  const startMs = performance.now();
  const target = process.argv[2] ?? "all-completed";
  const vitestBin = resolve(ROOT, "node_modules/vitest/vitest.mjs");
  const steps = [
    ["1/8 TypeScript check", NPM_CMD, ["run", "typecheck"]],
    ["2/8 ESLint & folder-size check", NPM_CMD, ["run", "lint"]],
    ["3/8 Production build", NPM_CMD, ["run", "build"]],
    ["4/8 Vitest suite (JSON report)", process.execPath, [vitestBin, "run", "--reporter=default", "--reporter=json", "--outputFile=.verify-reports/vitest.json"]],
    ["5/8 Static content & contract audit", NPM_CMD, ["run", "verify:content"]],
    ["6/8 Documentation integrity check", NPM_CMD, ["run", "verify:docs"]],
    ["7/8 Playwright Desktop & Mobile E2E", NPM_CMD, ["run", "verify:e2e"]],
    [`8/8 Spec REQ coverage (${target})`, NPM_CMD, ["run", "verify:spec", "--", target]],
  ];
  for (const [label, cmd, args] of steps) runStep({ label, cmd, args, startMs });
  writeFeedback(true, performance.now() - startMs);
  console.log(`\n=== [verify:phase] ALL 4 LAYERS PASSED (${target}) ===`);
}

main();
