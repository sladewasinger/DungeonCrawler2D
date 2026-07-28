/** Resolves deterministic terrain interactions shared by clients and the authoritative server. */
import { INTERACT_RANGE } from "../../core/constants.js";
import {
  FEATURE_FACE,
  TILE,
  type FeatureFace,
  type TileType,
} from "../core/types.js";
import { featureAnchor, isOnFeatureSide } from "./interactionGeometry.js";

export {
  featureAnchor,
  featureApproachPosition,
} from "./interactionGeometry.js";

export type WorldInteractionKind = "door" | "stash" | "craft";

export interface WorldInteractionWorld {
  tileAt(wx: number, wy: number): TileType;
  featureAt?(wx: number, wy: number): TileType;
  featureFaceAt?(wx: number, wy: number): FeatureFace;
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

export interface WorldInteractionQuery {
  world: WorldInteractionWorld;
  x: number;
  y: number;
  kind: WorldInteractionKind;
}

export function findWorldInteractionTarget({ world, x, y, kind }: WorldInteractionQuery): WorldInteractionTarget | null {
  const radius = Math.ceil(INTERACT_RANGE);
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let best: WorldInteractionTarget | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) ({ best, bestDistance } = findBetterTarget({ world, x, y, kind, cx, cy, dx, dy, best, bestDistance }));
  }
  return best;
}

type TargetSearch = WorldInteractionQuery & {
  readonly cx: number;
  readonly cy: number;
  readonly dx: number;
  readonly dy: number;
  readonly best: WorldInteractionTarget | null;
  readonly bestDistance: number;
};

function findBetterTarget(search: TargetSearch): {
  best: WorldInteractionTarget | null;
  bestDistance: number;
} {
  const { best, bestDistance } = search;
  const evaluated = evaluateTarget(search);
  if (!evaluated || !isPreferredTarget({ ...evaluated, best, bestDistance })) {
    return { best, bestDistance };
  }
  return { best: evaluated.candidate, bestDistance: evaluated.distance };
}

function evaluateTarget(search: TargetSearch): {
  candidate: WorldInteractionTarget;
  distance: number;
} | null {
  const { world, x, y, kind, cx, cy, dx, dy } = search;
  const tx = cx + dx;
  const ty = cy + dy;
  const tile = world.featureAt?.(tx, ty) ?? world.tileAt(tx, ty);
  const face = world.featureFaceAt?.(tx, ty) ?? FEATURE_FACE.Top;
  const anchor = featureAnchor({ x: tx, y: ty }, face);
  const distance = Math.hypot(anchor.x - x, anchor.y - y);
  const candidate = { kind, tile, x: tx, y: ty } satisfies WorldInteractionTarget;
  if (kindOf(tile) !== kind ||
      !isOnFeatureSide({ x, y }, anchor, face) ||
      distance > INTERACT_RANGE) return null;
  return { candidate, distance };
}

function isPreferredTarget({ candidate, distance, best, bestDistance }: { candidate: WorldInteractionTarget; distance: number; best: WorldInteractionTarget | null; bestDistance: number }): boolean {
  return distance < bestDistance || (distance === bestDistance && best !== null && targetOrder(candidate, best) < 0);
}

export function resolveWorldInteraction(
  world: WorldInteractionWorld,
  x: number,
  y: number,
): WorldInteractionTarget | null {
  return findWorldInteractionTarget({ world, x, y, kind: "door" })
    ?? findWorldInteractionTarget({ world, x, y, kind: "stash" })
    ?? findWorldInteractionTarget({ world, x, y, kind: "craft" });
}
