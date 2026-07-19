// Pure content/world lookups backing input/index.ts's InputQueries contract: item
// throwability, recipe ids, nearest-entity and nearest-tile proximity checks. No
// Phaser, no Connection — callers inject just the data these need to stay plain-
// function testable.
import { itemsData, recipesData } from "@dc2d/content";
import type { TileType } from "@dc2d/engine";

interface ItemDef {
  readonly id: string;
  readonly name?: string;
  readonly weapon?: unknown;
  readonly consumable?: unknown;
  readonly throwable?: unknown;
}

function isItemDef(value: unknown): value is ItemDef {
  return typeof (value as Partial<ItemDef>)?.id === "string";
}

const itemById = new Map<string, ItemDef>(
  (itemsData as readonly unknown[]).filter(isItemDef).map((def) => [def.id, def]),
);

export function isThrowableItem(itemDefId: string): boolean {
  return !!itemById.get(itemDefId)?.throwable;
}

export type ItemCategory = "weapons" | "usables" | "materials";

/**
 * Weapon → Weapons, consumable-or-throwable → Usables, else Materials — ported
 * verbatim from reference/client/ui/inventoryPanel.ts's categoryOf() (HUD_OS.md §7).
 */
export function categoryOfItem(itemDefId: string): ItemCategory {
  const def = itemById.get(itemDefId);
  if (def?.weapon) return "weapons";
  if (def?.consumable || def?.throwable) return "usables";
  return "materials";
}

/** Item def's display name, falling back to the raw id for an unknown def. */
export function itemName(itemDefId: string): string {
  return itemById.get(itemDefId)?.name ?? itemDefId;
}

interface RecipeDef {
  readonly id: string;
}

function isRecipeDef(value: unknown): value is RecipeDef {
  return typeof (value as Partial<RecipeDef>)?.id === "string";
}

const recipeList: readonly RecipeDef[] = (recipesData as readonly unknown[]).filter(isRecipeDef);

export function recipeIdAtIndex(index: number): string | undefined {
  return recipeList[index]?.id;
}

export interface PositionedEntity {
  readonly id: string;
  readonly kind: string;
  readonly x: number;
  readonly y: number;
}

/** Nearest entity of `kind` within `maxDistance`, or undefined — used for party-invite targeting. */
export function nearestEntityId(
  entities: readonly PositionedEntity[],
  kind: string,
  fromX: number,
  fromY: number,
  maxDistance: number,
): string | undefined {
  let bestId: string | undefined;
  let bestDistance = maxDistance;
  for (const entity of entities) {
    if (entity.kind !== kind) continue;
    const distance = Math.hypot(entity.x - fromX, entity.y - fromY);
    if (distance <= bestDistance) {
      bestDistance = distance;
      bestId = entity.id;
    }
  }
  return bestId;
}

export interface TileWorld {
  tileAt(wx: number, wy: number): TileType;
}

/** Any matching tile within a 3x3 neighborhood of (x, y) — the same interact radius as interactionPrompt.ts. */
export function isTileTypeNearby(world: TileWorld, tile: TileType, x: number, y: number): boolean {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (world.tileAt(cx + dx, cy + dy) === tile) return true;
    }
  }
  return false;
}
