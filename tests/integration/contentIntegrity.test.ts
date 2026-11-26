/** Live TypeScript cross-package invariants for items, icons, held gear, PropSpecs, and public assets. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REGISTERED_HELD_GEAR_IDS } from "../../packages/client/src/render/character/heldWeapons.js";
import { REGISTERED_PROP_RENDER_KINDS } from "../../packages/client/src/render/world/chunkProps.js";
import { REGISTERED_ITEM_ICON_IDS } from "../../packages/client/src/ui/icons/itemIcons.js";
import {
  ALL_LOOT_TABLE_ITEM_IDS, ITEM_CATALOG, PROP_SPECS, RECIPE_CATALOG,
  STARTER_ARMOR, STARTER_LOADOUT, getItemDef, type ItemDef,
} from "@dc2d/content";
import { PROP_KIND_VALUES } from "@dc2d/contracts";
import { HARVEST_NODE_SPECS } from "@dc2d/engine";

const ROOT = process.cwd();
const MANIFEST_ALLOWLIST = new Set(["assets/sprite-manifest.json", "assets/player/player-rig.json"]);

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const stripLeadingSlash = (path: string): string => path.replace(/^\//, "");

function readSpriteManifestPaths(pubDir: string, out: Set<string>): void {
  const spriteManifest = JSON.parse(readFileSync(resolve(pubDir, "assets/sprite-manifest.json"), "utf8")) as {
    assets?: Record<string, { path?: string; animations?: { sheetPath?: string } }>;
  };
  for (const entry of Object.values(spriteManifest.assets ?? {})) {
    if (entry.path) out.add(stripLeadingSlash(entry.path));
    if (entry.animations?.sheetPath) out.add(stripLeadingSlash(entry.animations.sheetPath));
  }
}

function readRigManifestPaths(pubDir: string, out: Set<string>): void {
  const rigMeta = JSON.parse(readFileSync(resolve(pubDir, "assets/player/player-rig.json"), "utf8")) as {
    layers?: string[];
    bowOverlay?: { path?: string };
  };
  for (const layer of rigMeta.layers ?? []) out.add(`assets/player/${layer}.webp`);
  if (rigMeta.bowOverlay?.path) out.add(stripLeadingSlash(rigMeta.bowOverlay.path));
}

function collectExpectedAssetPaths(): Set<string> {
  const pubDir = resolve(ROOT, "packages/client/public");
  const expected = new Set<string>(MANIFEST_ALLOWLIST);
  readSpriteManifestPaths(pubDir, expected);
  readRigManifestPaths(pubDir, expected);
  return expected;
}

function collectAcquisitionItemIds(): Set<string> {
  const ids = new Set<string>([
    ...ALL_LOOT_TABLE_ITEM_IDS,
    ...STARTER_LOADOUT.map((entry) => entry.itemId),
    ...Object.values(STARTER_ARMOR).filter((id): id is string => Boolean(id)),
    ...RECIPE_CATALOG.map((r) => r.outputItemId),
  ]);
  for (const spec of Object.values(HARVEST_NODE_SPECS)) {
    if (!spec) continue;
    for (const drop of spec.drops) ids.add(drop.itemId);
  }
  return ids;
}

const requiresHeldVisual = (item: ItemDef): boolean =>
  item.weaponArchetype !== undefined || item.armorSlot === "offhand" || item.id === "bow";

function assertItemValid(opts: {
  readonly item: ItemDef; readonly seen: Set<string>;
  readonly iconSet: Set<string>; readonly heldSet: Set<string>; readonly acquiredSet: Set<string>;
}): void {
  const { item, seen, iconSet, heldSet, acquiredSet } = opts;
  expect(seen.has(item.id), `Duplicate item id: ${item.id}`).toBe(false);
  seen.add(item.id);
  expect(item.name.trim().length).toBeGreaterThan(0);
  expect(item.description?.trim().length ?? 0, `Missing description on ${item.id}`).toBeGreaterThan(0);
  expect(["common", "uncommon", "rare", "epic", "legendary"]).toContain(item.rarity ?? "common");
  expect(item.maxStack).toBeGreaterThanOrEqual(1);
  expect(iconSet.has(item.id), `Missing 32x32 icon painter for '${item.id}'`).toBe(true);
  expect(acquiredSet.has(item.id), `Item '${item.id}' has no starter/recipe/harvest/loot acquisition path`).toBe(true);
  if (requiresHeldVisual(item)) expect(heldSet.has(item.id), `Missing held gear visual for '${item.id}'`).toBe(true);
}

function assertPropsRegisteredAndValid(): void {
  const mountedProps = new Set(REGISTERED_PROP_RENDER_KINDS);
  for (const kind of PROP_KIND_VALUES) {
    expect(PROP_SPECS[kind]?.kind, `Missing PROP_SPECS entry for ${kind}`).toBe(kind);
    expect(mountedProps.has(kind), `PropKind '${kind}' is not mounted in chunkProps.ts`).toBe(true);
  }
}

function assertHarvestDropsValid(): void {
  for (const spec of Object.values(HARVEST_NODE_SPECS)) {
    for (const drop of spec?.drops ?? []) expect(getItemDef(drop.itemId)).toBeDefined();
  }
}

function assertStartersAndDropsValid(): void {
  for (const entry of STARTER_LOADOUT) expect(getItemDef(entry.itemId)).toBeDefined();
  for (const itemId of Object.values(STARTER_ARMOR)) {
    if (itemId) expect(getItemDef(itemId)).toBeDefined();
  }
  assertHarvestDropsValid();
}

function assertAssetsMatchManifests(): void {
  const pubDir = resolve(ROOT, "packages/client/public");
  const expected = collectExpectedAssetPaths();
  const actual = walkFiles(resolve(pubDir, "assets"))
    .map((abs) => abs.slice(pubDir.length + 1).replace(/\\/g, "/"));
  for (const rel of actual) expect(expected.has(rel), `Unreferenced public asset (orphan): ${rel}`).toBe(true);
  for (const rel of expected) expect(existsSync(resolve(pubDir, rel)), `Manifest asset missing on disk: ${rel}`).toBe(true);
}

describe("content integrity invariants [static]", () => {
  it("validates every ITEM_CATALOG item has unique id, metadata, icon, held visual, and acquisition path", () => {
    const seen = new Set<string>();
    const iconSet = new Set(REGISTERED_ITEM_ICON_IDS);
    const heldSet = new Set(REGISTERED_HELD_GEAR_IDS);
    const acquiredSet = collectAcquisitionItemIds();
    for (const item of ITEM_CATALOG) assertItemValid({ item, seen, iconSet, heldSet, acquiredSet });
  });

  it("validates every RECIPE_CATALOG output and ingredient exists in ITEM_CATALOG", () => {
    const seen = new Set<string>();
    for (const recipe of RECIPE_CATALOG) {
      expect(seen.has(recipe.id), `Duplicate recipe id: ${recipe.id}`).toBe(false);
      seen.add(recipe.id);
      expect(getItemDef(recipe.outputItemId), `Missing output '${recipe.outputItemId}' in ${recipe.id}`).toBeDefined();
      expect(recipe.outputCount).toBeGreaterThanOrEqual(1);
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      for (const ing of recipe.ingredients) {
        expect(getItemDef(ing.itemId), `Missing ingredient '${ing.itemId}' in ${recipe.id}`).toBeDefined();
        expect(ing.count).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("validates starter gear, HARVEST_NODE_SPECS drops, PROP_SPECS, and chunk prop render mounts", () => {
    assertStartersAndDropsValid();
    assertPropsRegisteredAndValid();
  });

  it("enforces zero orphan or missing files under packages/client/public/assets", () => {
    assertAssetsMatchManifests();
  });
});
