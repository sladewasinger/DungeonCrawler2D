/** AST/hygiene helper preventing hardcoded starter item IDs outside approved catalog/render modules. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE_RE = /\.ts$/;

export function collectTsFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) collectTsFiles(full, out);
    else if (SOURCE_RE.test(entry.name) && !entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const ALLOWED_STARTER_ID_FILES = new Set([
  "catalog.ts", "recipes.ts", "lootTables.ts", "heldWeapons.ts", "itemIcons.ts",
  "combatRules.ts", "weaponMovesets.ts", "playerSprite.ts",
  "poseTunerPanel.ts", "sandboxCombat.ts", "sandboxMode.ts", "sandboxSetup.ts", "sandboxHelpers.ts",
]);

export function checkHardcodedStarterIds(rootDir) {
  const errors = [];
  const badRe = /(?:heldItem|offhand)\s*(?:===|!==)\s*"(?:bow|wooden-shield)"/;
  for (const pkg of ["engine", "game-server", "client"]) {
    for (const file of collectTsFiles(resolve(rootDir, "packages", pkg, "src"))) {
      const base = file.split(/[\\/]/).pop() ?? "";
      if (ALLOWED_STARTER_ID_FILES.has(base)) continue;
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        if (badRe.test(line)) errors.push(`Hardcoded starter item check in ${file}:${i + 1}`);
      });
    }
  }
  return errors;
}
