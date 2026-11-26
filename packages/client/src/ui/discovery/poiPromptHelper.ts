/** Resolves contextual [E] prompts for chests, craft stations, beds, forageables, shrines, and dismantling. */
import { getItemDef } from "@dc2d/content";
import {
  AI_TUNING, PropKind, getPoiCatalogEntry,
  type ChunkPoi, type ChunkProp, type GroundLootSnapshot, type PlayerSnapshot, type PoiKind,
  type WorldChestSnapshot, type WorldChunkCache,
} from "@dc2d/engine";

export type WorldPromptKind = "chest" | "loot" | "workbench" | "campfire" | "bed" | "forage" | "poi";

export interface WorldPromptResult {
  readonly label: string;
  readonly locked: boolean;
  readonly kind: WorldPromptKind;
  readonly prop?: ChunkProp | undefined;
}

const SHRINE_PROMPT: Readonly<Record<string, string>> = {
  waystone: "[E] Attune Waystone",
  swiftness: "[E] Activate Wind Shrine",
  vigor: "[E] Activate Vigor Wellspring",
  shadow: "[E] Activate Shadow Altar",
};

const FORAGE_KINDS = new Set<PropKind>([
  PropKind.Bush, PropKind.Wildflower, PropKind.GiantMushroom, PropKind.BogReed,
]);

const DISMANTLE_KINDS = new Set<PropKind>([
  PropKind.Campfire, PropKind.Torch, PropKind.WoodChest, PropKind.Workbench, PropKind.Bed, PropKind.Palisade,
]);

function chestLabel(chest: WorldChestSnapshot): string {
  const name = chest.poiKind === "player-chest" ? "Storage Chest" : getPoiCatalogEntry(chest.poiKind as PoiKind).displayName;
  if (chest.sealed) return `Sealed Vault (${chest.braziersLit ?? 0}/${chest.braziersTotal ?? 3} Braziers)`;
  return `[E] Open ${name}`;
}

function poiInteractLabel(cache: WorldChunkCache, poi: ChunkPoi, local: PlayerSnapshot): string | null {
  const unlit = (poi.brazierPositions ?? []).find((b) => !cache.isBrazierLit(b.id) && Math.hypot(b.x - local.x, b.y - local.y) <= 2.4);
  if (unlit) return "[E] Light Brazier (Torch / Fire)";
  if (Math.hypot(poi.centerX - local.x, poi.centerY - local.y) > 3.1) return null;
  if (poi.shrineKind && SHRINE_PROMPT[poi.shrineKind]) return SHRINE_PROMPT[poi.shrineKind]!;
  return poi.loreText ? `[E] Read ${getPoiCatalogEntry(poi.kind).displayName}` : null;
}

function nearestPoiPrompt(cache: WorldChunkCache, local: PlayerSnapshot): WorldPromptResult | null {
  for (const poi of cache.poisNear(local.x, local.y)) {
    const label = poiInteractLabel(cache, poi, local);
    if (label) return { label, locked: false, kind: "poi" };
  }
  return null;
}

function lootPromptLabel(loot: GroundLootSnapshot | undefined, local: PlayerSnapshot | undefined): WorldPromptResult | null {
  if (!loot || !local) return null;
  if (Math.hypot(loot.x - local.x, loot.y - local.y) > AI_TUNING.chestInteractRadiusTiles) return null;
  return { label: `[E] Pick up ${getItemDef(loot.itemId)?.name ?? loot.itemId}`, locked: false, kind: "loot" };
}

function stationPromptForProp(prop: ChunkProp): WorldPromptResult | null {
  if (prop.kind === PropKind.Workbench) return { label: "[E] Craft (Workbench)", locked: false, kind: "workbench", prop };
  if (prop.kind === PropKind.Campfire) return { label: "[E] Cook & Smelt", locked: false, kind: "campfire", prop };
  if (prop.kind === PropKind.Bed) return { label: "[E] Set Respawn Bed", locked: false, kind: "bed", prop };
  return null;
}

function candidatePromptForProp(prop: ChunkProp, dist: number, touch: boolean): WorldPromptResult | null {
  const st = stationPromptForProp(prop);
  if (st) return st;
  if (FORAGE_KINDS.has(prop.kind) && !prop.depleted && dist <= 2.2) {
    return { label: touch ? "FORAGE" : "[E] Forage", locked: false, kind: "forage", prop };
  }
  return null;
}

function findNearestInteractProp(cache: WorldChunkCache, local: PlayerSnapshot, touch = false): WorldPromptResult | null {
  let best: WorldPromptResult | null = null;
  let bestDist = 2.41;
  for (const prop of cache.propsNear(local.x, local.y)) {
    const dist = prop.elevation === local.elevation ? Math.hypot(prop.x - local.x, prop.y - local.y) : 99;
    if (dist >= bestDist) continue;
    const hit = candidatePromptForProp(prop, dist, touch);
    if (hit) { bestDist = dist; best = hit; }
  }
  return best;
}

export function findNearestDismantleableProp(cache: WorldChunkCache | undefined, local: PlayerSnapshot | undefined): ChunkProp | null {
  if (!cache || !local) return null;
  let best: ChunkProp | null = null;
  let bestDist = 2.4;
  for (const prop of cache.propsNear(local.x, local.y)) {
    if (!prop.id.startsWith("struct-") || !DISMANTLE_KINDS.has(prop.kind) || prop.elevation !== local.elevation) continue;
    const d = Math.hypot(prop.x - local.x, prop.y - local.y);
    if (d <= bestDist) { bestDist = d; best = prop; }
  }
  return best;
}

export function resolveWorldInteractPrompt(opts: {
  readonly nearestChest: WorldChestSnapshot | undefined;
  readonly nearestLoot: GroundLootSnapshot | undefined;
  readonly local: PlayerSnapshot | undefined;
  readonly cache?: WorldChunkCache | undefined;
  readonly touch?: boolean | undefined;
}): WorldPromptResult | null {
  const { nearestChest, nearestLoot, local, cache, touch } = opts;
  if (nearestChest) return { label: chestLabel(nearestChest), locked: Boolean(nearestChest.sealed), kind: "chest" };
  const lootRes = lootPromptLabel(nearestLoot, local);
  if (lootRes) return lootRes;
  const propRes = cache && local ? findNearestInteractProp(cache, local, touch) : null;
  if (propRes) return propRes;
  return cache && local ? nearestPoiPrompt(cache, local) : null;
}

export function sealedVaultHint(chest: Pick<WorldChestSnapshot, "braziersLit" | "braziersTotal">): string {
  return `Light all braziers (${chest.braziersLit ?? 0}/${chest.braziersTotal ?? 3}) with a Torch or fire weapon`;
}
