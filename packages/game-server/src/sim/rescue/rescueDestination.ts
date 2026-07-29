import { TERRAIN } from "@dc2d/engine";
import { RESCUE_TUNING } from "./configuration/rescueTuning.js";
import {
  reachableRescueTiles,
  tileKey,
} from "./rescueReachability.js";
import type { RescueWorld } from "./rescueWorld.js";

const GROUND_EPSILON = 0.000_001;
const PLATFORM_OFFSETS = [
  { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 },
  { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
] as const;

export interface RescueDestination {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RescueDestinationSearch {
  readonly world: RescueWorld;
  readonly from: { readonly x: number; readonly y: number };
  readonly allowsTile: (x: number, y: number) => boolean;
  readonly isOccupied: (x: number, y: number) => boolean;
}

interface TileOffset {
  readonly x: number;
  readonly y: number;
}

/** Finds the closest tile center backed by one flat, unobstructed 3×3 floor. */
export function findRescueDestination(
  search: RescueDestinationSearch,
): RescueDestination | null {
  const { world, from } = search;
  const originX = Math.floor(from.x);
  const originY = Math.floor(from.y);
  const reachable = reachableRescueTiles({
    world,
    origin: from,
    radius: RESCUE_TUNING.destinationSearchRadiusTiles,
  });
  for (const offset of orderedSearchOffsets(from)) {
    const tileX = originX + offset.x;
    const tileY = originY + offset.y;
    if (reachable.has(tileKey(tileX, tileY))) continue;
    const ground = flatPlatformGround(search, tileX, tileY);
    if (ground === null) continue;
    return { x: tileX + 0.5, y: tileY + 0.5, z: ground };
  }
  return null;
}

function flatPlatformGround(
  search: RescueDestinationSearch,
  centerX: number,
  centerY: number,
): number | null {
  let sharedGround: number | null = null;
  for (const offset of PLATFORM_OFFSETS) {
    const ground = validFloorGround(
      search,
      centerX + offset.x,
      centerY + offset.y,
    );
    if (ground === null) return null;
    if (sharedGround === null) sharedGround = ground;
    else if (Math.abs(sharedGround - ground) > GROUND_EPSILON) return null;
  }
  return sharedGround;
}

function validFloorGround(
  search: RescueDestinationSearch,
  x: number,
  y: number,
): number | null {
  const { world } = search;
  if (!search.allowsTile(x, y) || search.isOccupied(x, y)) return null;
  if (!world.isWalkable(x, y) || world.terrainAt(x, y) !== TERRAIN.Floor) return null;
  const height = world.heightAt(x, y);
  const ground = world.groundAt(x + 0.5, y + 0.5);
  if (!Number.isFinite(height) || !Number.isFinite(ground)) return null;
  return Math.abs(height - ground) <= GROUND_EPSILON ? ground : null;
}

let cachedOffsets: readonly TileOffset[] | undefined;

function rescueSearchOffsets(): readonly TileOffset[] {
  cachedOffsets ??= buildSearchOffsets(RESCUE_TUNING.destinationSearchRadiusTiles);
  return cachedOffsets;
}

function orderedSearchOffsets(from: { readonly x: number; readonly y: number }): TileOffset[] {
  const fractional = {
    x: from.x - Math.floor(from.x),
    y: from.y - Math.floor(from.y),
  };
  return [...rescueSearchOffsets()].sort((a, b) =>
    compareOffsetDistance(a, b, fractional));
}

function compareOffsetDistance(
  a: TileOffset,
  b: TileOffset,
  fractional: { readonly x: number; readonly y: number },
): number {
  return offsetDistance(a, fractional) - offsetDistance(b, fractional) ||
    a.y - b.y || a.x - b.x;
}

function offsetDistance(
  offset: TileOffset,
  fractional: { readonly x: number; readonly y: number },
): number {
  const x = offset.x + 0.5 - fractional.x;
  const y = offset.y + 0.5 - fractional.y;
  return x * x + y * y;
}

function buildSearchOffsets(radius: number): readonly TileOffset[] {
  const offsets: TileOffset[] = [];
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const distanceSquared = x * x + y * y;
      if (distanceSquared <= radius * radius) offsets.push({ x, y });
    }
  }
  return offsets;
}
