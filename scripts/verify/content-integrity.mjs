/** Static Layer-2 verification: item icons, held gear, PropKind mounts, starter-ID hygiene, and catalog invariants. */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import {
  checkHardcodedStarterIds, checkPropMountCoverage, extractIconKeys, extractItemCatalogDefs, extractPropKinds,
} from "./contentAuditHelpers.mjs";

const ROOT = process.cwd();

function runContentVitest() {
  const vitestBin = resolve(ROOT, "node_modules/vitest/vitest.mjs");
  execFileSync(process.execPath, [vitestBin, "run", "tests/integration/contentIntegrity.test.ts"], {
    stdio: "inherit",
    cwd: ROOT,
  });
}

function checkHeldGearCoverage(items) {
  const heldBase = readFileSync(resolve(ROOT, "packages/client/src/render/character/heldWeapons.ts"), "utf8");
  const heldFrontier = readFileSync(resolve(ROOT, "packages/client/src/render/character/atlas/frontierHeldGear.ts"), "utf8");
  const combined = `${heldBase}\n${heldFrontier}`;
  return items
    .filter((item) => item.isHeld && item.id !== "torch" && item.id !== "wooden-shield")
    .filter((item) => !combined.includes(`"${item.id}"`) && !combined.includes(`${item.id}:`))
    .map((item) => `Missing held weapon/shield visual for '${item.id}'`);
}

function checkAcquisitionPaths(items) {
  const catalog = readFileSync(resolve(ROOT, "packages/content/src/items/catalog.ts"), "utf8");
  const starterBlock = catalog.slice(catalog.indexOf("STARTER_ARMOR"), catalog.indexOf("const BASE_ITEMS"))
    + catalog.slice(catalog.indexOf("STARTER_LOADOUT"));
  const sources = [
    "packages/content/src/items/lootTables.ts",
    "packages/content/src/recipes/recipes.ts",
    "packages/content/src/recipes/frontierRecipes.ts",
    "packages/engine/src/survival/harvestRules.ts",
    "packages/game-server/src/sim/wildlife/creatureSpecs.ts",
  ].map((p) => readFileSync(resolve(ROOT, p), "utf8")).concat(starterBlock).join("\n");
  return items
    .filter((item) => item.id !== "map")
    .filter((item) => !sources.includes(`"${item.id}"`))
    .map((item) => `Item '${item.id}' has no acquisition path (recipe/loot/harvest/starter)`);
}

function main() {
  runContentVitest();
  const items = extractItemCatalogDefs(ROOT);
  const iconKeys = extractIconKeys(ROOT);
  const errors = [
    ...items.filter((i) => !iconKeys.has(i.id)).map((i) => `Missing 32x32 icon painter for '${i.id}'`),
    ...checkHeldGearCoverage(items),
    ...checkAcquisitionPaths(items),
    ...checkPropMountCoverage(ROOT, extractPropKinds(ROOT)),
    ...checkHardcodedStarterIds(ROOT),
  ];
  mkdirSync(resolve(ROOT, ".verify-reports"), { recursive: true });
  writeFileSync(resolve(ROOT, ".verify-reports/content.json"), JSON.stringify({
    ok: errors.length === 0,
    itemCount: items.length,
    errors,
    timestamp: new Date().toISOString(),
  }, null, 2), "utf8");
  if (errors.length > 0) {
    for (const err of errors) console.error(`[verify:content] FAIL: ${err}`);
    process.exit(1);
  }
  console.log(`[verify:content] PASS (${items.length} items, icons, held gear, PropKinds, and contract hygiene verified)`);
}

main();
