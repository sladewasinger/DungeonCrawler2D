/** Helper extractors for static item, icon, held-gear, prop, and hardcoded-ID audits. */
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

export function extractItemCatalogDefs(rootDir) {
  const itemDir = resolve(rootDir, "packages/content/src/items");
  const files = ["catalog.ts", "frontierWeapons.ts", "frontierArmor.ts", "frontierMaterials.ts"];
  const items = [];
  const re = /\{\s*id:\s*"([^"]+)"[^}]*?\}/gs;
  for (const file of files) {
    const text = readFileSync(resolve(itemDir, file), "utf8");
    for (const m of text.matchAll(re)) {
      const id = m[1];
      if (!id) continue;
      const body = m[0];
      const isHeld = /weaponArchetype:|armorSlot:\s*"offhand"/.test(body) || id === "bow";
      items.push({ id, isHeld, isShield: /armorSlot:\s*"offhand"/.test(body) });
    }
  }
  return items;
}

export function extractIconKeys(rootDir) {
  const iconDir = resolve(rootDir, "packages/client/src/ui/icons");
  const files = ["itemIcons.ts", "campItemIcons.ts", "weaponItemIcons.ts", "frontierItemIcons.ts"];
  const joined = files.map((f) => readFileSync(resolve(iconDir, f), "utf8")).join("\n");
  const keys = new Set();
  for (const m of joined.matchAll(/(?:"([a-z0-9-]+)"|([a-z][a-zA-Z0-9]*))\s*:/g)) {
    keys.add(m[1] ?? m[2]);
  }
  return keys;
}

export function extractPropKinds(rootDir) {
  const text = readFileSync(resolve(rootDir, "packages/engine/src/world/types.ts"), "utf8");
  const block = text.match(/export const enum PropKind \{([\s\S]*?)\}/)?.[1] ?? "";
  return [...block.matchAll(/^\s*([A-Za-z0-9_]+)\s*=/gm)].map((m) => m[1]);
}

export function checkPropMountCoverage(rootDir, propKinds) {
  const chunkProps = readFileSync(resolve(rootDir, "packages/client/src/render/world/chunkProps.ts"), "utf8");
  const propTextures = readFileSync(resolve(rootDir, "packages/client/src/render/textures/propTextures.ts"), "utf8");
  const combined = `${chunkProps}\n${propTextures}`;
  return propKinds
    .filter((k) => !combined.includes(`PropKind.${k}`) && !(k === "Stump" && chunkProps.includes("p.stump")))
    .map((k) => `PropKind.${k} is not mounted in chunkProps.ts or propTextures.ts`);
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
