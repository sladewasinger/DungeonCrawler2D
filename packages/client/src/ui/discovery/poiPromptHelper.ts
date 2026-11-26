/** Resolves contextual [E] world interaction prompts for chests, sealed vaults, loot, braziers, shrines, and lore POIs. */
import { getItemDef } from "@dc2d/content";
import {
  AI_TUNING, getPoiCatalogEntry,
  type ChunkPoi, type GroundLootSnapshot, type PlayerSnapshot, type PoiKind,
  type WorldChestSnapshot, type WorldChunkCache,
} from "@dc2d/engine";

const SHRINE_PROMPT: Readonly<Record<string, string>> = {
  waystone: "[E] Attune Waystone",
  swiftness: "[E] Activate Wind Shrine",
  vigor: "[E] Activate Vigor Wellspring",
  shadow: "[E] Activate Shadow Altar",
};

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

function nearestPoiPrompt(cache: WorldChunkCache, local: PlayerSnapshot): string | null {
  for (const poi of cache.poisNear(local.x, local.y)) {
    const label = poiInteractLabel(cache, poi, local);
    if (label) return label;
  }
  return null;
}

function lootPromptLabel(loot: GroundLootSnapshot | undefined, local: PlayerSnapshot | undefined): string | null {
  if (!loot || !local) return null;
  if (Math.hypot(loot.x - local.x, loot.y - local.y) > AI_TUNING.chestInteractRadiusTiles) return null;
  return `[E] Pick up ${getItemDef(loot.itemId)?.name ?? loot.itemId}`;
}

export function resolveWorldInteractPrompt(opts: {
  readonly nearestChest: WorldChestSnapshot | undefined;
  readonly nearestLoot: GroundLootSnapshot | undefined;
  readonly local: PlayerSnapshot | undefined;
  readonly cache?: WorldChunkCache | undefined;
}): { readonly label: string; readonly locked: boolean } | null {
  const { nearestChest, nearestLoot, local, cache } = opts;
  if (nearestChest) return { label: chestLabel(nearestChest), locked: Boolean(nearestChest.sealed) };
  const lootLabel = lootPromptLabel(nearestLoot, local);
  if (lootLabel) return { label: lootLabel, locked: false };
  const poiLabel = cache && local ? nearestPoiPrompt(cache, local) : null;
  return poiLabel ? { label: poiLabel, locked: false } : null;
}

export function sealedVaultHint(chest: Pick<WorldChestSnapshot, "braziersLit" | "braziersTotal">): string {
  return `Light all braziers (${chest.braziersLit ?? 0}/${chest.braziersTotal ?? 3}) with a Torch or fire weapon`;
}