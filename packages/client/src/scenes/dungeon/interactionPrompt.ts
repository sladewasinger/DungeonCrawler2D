// Contextual "[key] label" prompt resolution: a nearby stairway (Epic 7.14) takes
// priority over interact (crafting table / stash / any door), which takes priority
// over pickup, matching the E/R key split in input/index.ts.
import { INTERACT_RANGE, PICKUP_RANGE, TILE, type TileType } from "@dc2d/engine";
import { descentPromptLabel } from "./descentPrompt.js";
import { resolveStairwayPrompt, type StairwayWorld } from "./stairwayProximity.js";

export interface PromptWorld extends StairwayWorld {
  tileAt(wx: number, wy: number): TileType;
}

export interface PromptTarget {
  readonly x: number;
  readonly y: number;
}

const INTERACT_TILES: ReadonlySet<TileType> = new Set([
  TILE.CraftingTable,
  TILE.Stash,
  TILE.DoorPersonal,
  TILE.DoorParty,
  TILE.DoorExit,
  TILE.DoorSafeRoom,
]);

/** Scans the 3x3 tile neighborhood around (x, y) for an interactable within range. */
function hasNearbyInteractTile(world: PromptWorld, x: number, y: number): boolean {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = cx + dx;
      const ty = cy + dy;
      if (!INTERACT_TILES.has(world.tileAt(tx, ty))) continue;
      if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) <= INTERACT_RANGE) return true;
    }
  }
  return false;
}

function hasNearbyItem(items: readonly PromptTarget[], x: number, y: number): boolean {
  return items.some((item) => Math.hypot(item.x - x, item.y - y) <= PICKUP_RANGE);
}

export interface InteractionPrompt {
  readonly key: string;
  readonly label: string;
}

/** The contextual prompt for the player's current position, or null when nothing is in range. */
export function resolveInteractionPrompt(
  world: PromptWorld,
  x: number,
  y: number,
  items: readonly PromptTarget[],
): InteractionPrompt | null {
  const stairway = resolveStairwayPrompt(world, x, y);
  if (stairway) return { key: "E", label: descentPromptLabel(stairway.direction, stairway.floor) };
  if (hasNearbyInteractTile(world, x, y)) return { key: "E", label: "interact" };
  if (hasNearbyItem(items, x, y)) return { key: "R", label: "pick up" };
  return null;
}
