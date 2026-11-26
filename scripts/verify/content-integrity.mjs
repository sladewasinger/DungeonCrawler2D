/** Static Layer-2 verification: cross-package integrity, live TS registries, and starter-ID hygiene. */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { checkHardcodedStarterIds } from "./contentAuditHelpers.mjs";

const ROOT = process.cwd();

function runContentVitest() {
  const vitestBin = resolve(ROOT, "node_modules/vitest/vitest.mjs");
  execFileSync(process.execPath, [vitestBin, "run", "tests/integration/contentIntegrity.test.ts"], {
    stdio: "inherit",
    cwd: ROOT,
  });
}

function main() {
  runContentVitest();
  const errors = checkHardcodedStarterIds(ROOT);
  mkdirSync(resolve(ROOT, ".verify-reports"), { recursive: true });
  writeFileSync(resolve(ROOT, ".verify-reports/content.json"), JSON.stringify({
    ok: errors.length === 0,
    errors,
    timestamp: new Date().toISOString(),
  }, null, 2), "utf8");
  if (errors.length > 0) {
    for (const err of errors) console.error(`[verify:content] FAIL: ${err}`);
    process.exit(1);
  }
  console.log("[verify:content] PASS (live TS item icons, held gear, PropKinds, public assets, and starter-ID hygiene verified)");
}

main();
