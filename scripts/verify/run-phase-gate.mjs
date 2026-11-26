/** Master phase gate runner executing all 4 verification layers sequentially. */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const NPM_CMD = process.platform === "win32" ? "npm.cmd" : "npm";

function runStep(label, cmd, args) {
  console.log(`\n=== [verify:phase] ${label} ===`);
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (res.status !== 0) {
    console.error(`\n[verify:phase] FAILED at step: ${label}`);
    process.exit(res.status ?? 1);
  }
}

function main() {
  const target = process.argv[2] ?? "all-completed";
  const vitestBin = resolve(ROOT, "node_modules/vitest/vitest.mjs");
  runStep("1/7 TypeScript check", NPM_CMD, ["run", "typecheck"]);
  runStep("2/7 ESLint & folder-size check", NPM_CMD, ["run", "lint"]);
  runStep("3/7 Production build", NPM_CMD, ["run", "build"]);
  runStep("4/7 Vitest suite (JSON report)", process.execPath, [
    vitestBin, "run", "--reporter=default", "--reporter=json", "--outputFile=.verify-reports/vitest.json",
  ]);
  runStep("5/7 Static content & contract audit", NPM_CMD, ["run", "verify:content"]);
  runStep("6/7 Playwright Desktop & Mobile E2E", NPM_CMD, ["run", "verify:e2e"]);
  runStep(`7/7 Spec REQ coverage (${target})`, NPM_CMD, ["run", "verify:spec", "--", target]);
  console.log(`\n=== [verify:phase] ALL 4 LAYERS PASSED (${target}) ===`);
}

main();
