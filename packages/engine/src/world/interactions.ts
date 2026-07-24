/** Resolves deterministic terrain interactions shared by clients and the authoritative server. */
import { INTERACT_RANGE } from "../core/constants.js";
import { TILE, type TileType } from "./types.js";

export type WorldInteractionKind = "door" | "stash" | "craft";

export interface WorldInteractionWorld {
  tileAt(wx: number, wy: number): TileType;
}

export interface WorldInteractionTarget {
  readonly kind: WorldInteractionKind;
  readonly tile: TileType;
  readonly x: number;
  readonly y: number;
}

const DOOR_TILES: ReadonlySet<TileType> = new Set([
  TILE.DoorSafeRoom,
  TILE.DoorPersonal,
  TILE.DoorParty,
  TILE.DoorExit,
]);

const kindOf = (tile: TileType): WorldInteractionKind | null => {
  if (DOOR_TILES.has(tile)) return "door";
  if (tile === TILE.Stash) return "stash";
  if (tile === TILE.CraftingTable) return "craft";
  return null;
};

const targetOrder = (a: WorldInteractionTarget, b: WorldInteractionTarget): number =>
  a.y - b.y || a.x - b.x;

export function findWorldInteractionTarget(
  world: WorldInteractionWorld,
  x: number,
  y: number,
  kind: WorldInteractionKind,
): WorldInteractionTarget | null {
  const radius = Math.ceil(INTERACT_RANGE);
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let best: WorldInteractionTarget | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const tx = cx + dx;
      const ty = cy + dy;
      const tile = world.tileAt(tx, ty);
      if (kindOf(tile) !== kind) continue;
      const distance = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
      if (distance > INTERACT_RANGE) continue;
      const candidate = { kind, tile, x: tx, y: ty } satisfies WorldInteractionTarget;
      if (distance < bestDistance || (distance === bestDistance && best && targetOrder(candidate, best) < 0)) {
        best = candidate;
        bestDistance = distance;
      }
    }
  }
  return best;
}

export function resolveWorldInteraction(
  world: WorldInteractionWorld,
  x: number,
  y: number,
): WorldInteractionTarget | null {
  return findWorldInteractionTarget(world, x, y, "door")
    ?? findWorldInteractionTarget(world, x, y, "stash")
    ?? findWorldInteractionTarget(world, x, y, "craft");
}
