import { hash2DFloat, mixSeeds } from "../../../core/rng.js";
import { TILE } from "../../core/types.js";
import { profileForBiome } from "../finiteFloorBiomeProfiles.js";
import { insideBounds, localIndex } from "../finiteFloorBuffers.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers, type FloorPoint, type GeneratedRoom } from "../finiteFloorTypes.js";
import { nearSpawn } from "./forestNoise.js";

export interface OpenWorldGladesInput {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly seed: number;
  readonly spawn: FloorPoint;
  readonly gridSize?: number;
}

const DEFAULT_GRID = 5;
const GLADE_RADIUS = 5;

export function placeOpenWorldGlades(input: OpenWorldGladesInput): GeneratedRoom[] {
  const grid = input.gridSize ?? DEFAULT_GRID;
  const rooms: GeneratedRoom[] = [];
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const room = tryBuildGlade({ input, gx, gy, grid, id: rooms.length });
      if (room) rooms.push(room);
    }
  }
  return rooms;
}

function tryBuildGlade(slot: {
  readonly input: OpenWorldGladesInput;
  readonly gx: number;
  readonly gy: number;
  readonly grid: number;
  readonly id: number;
}): GeneratedRoom | null {
  const { input, gx, gy, grid, id } = slot;
  const center = gladeCenter(input.bounds, input.seed, { gx, gy, grid });
  if (!isGladeCandidate(input, center)) return null;
  const rect = {
    x0: center.x - GLADE_RADIUS,
    y0: center.y - GLADE_RADIUS,
    x1: center.x + GLADE_RADIUS,
    y1: center.y + GLADE_RADIUS,
  };
  markGladeSpawnCore({ buffers: input.buffers, bounds: input.bounds, center, id });
  const index = localIndex({ bounds: input.bounds, ...center });
  return {
    id,
    regionId: 1,
    biome: profileForBiome(input.buffers.biome[index] ?? 0).biome,
    center,
    ...rect,
    wallEnvelope: rect,
    entrances: [{ position: center, axis: "horizontal", width: 1, connectedRegion: 1 }],
  };
}

function gladeCenter(
  bounds: FloorBounds,
  seed: number,
  slot: { readonly gx: number; readonly gy: number; readonly grid: number },
): FloorPoint {
  const cellW = (bounds.width - 24) / slot.grid;
  const cellH = (bounds.height - 24) / slot.grid;
  const jx = hash2DFloat(mixSeeds(seed, 0x33a1), slot.gx, slot.gy);
  const jy = hash2DFloat(mixSeeds(seed, 0x44b2), slot.gx, slot.gy);
  return {
    x: Math.floor(bounds.minX + 12 + (slot.gx + 0.2 + jx * 0.6) * cellW),
    y: Math.floor(bounds.minY + 12 + (slot.gy + 0.2 + jy * 0.6) * cellH),
  };
}

function isGladeCandidate(input: OpenWorldGladesInput, center: FloorPoint): boolean {
  if (!insideBounds({ bounds: input.bounds, ...center }) || nearSpawn(center, input.spawn, 10)) return false;
  const index = localIndex({ bounds: input.bounds, ...center });
  return input.buffers.tiles[index] === TILE.Floor
    && input.buffers.features[index] === TILE.Floor
    && input.buffers.semantic[index] === FLOOR_SEMANTIC.Corridor
    && (input.buffers.protectedCells[index] ?? 0) === 0;
}

const CORE_OFFSETS = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ x: dx, y: dy })));

function markGladeSpawnCore(core: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly center: FloorPoint;
  readonly id: number;
}): void {
  for (const offset of CORE_OFFSETS) {
    const pt = { x: core.center.x + offset.x, y: core.center.y + offset.y };
    if (!insideBounds({ bounds: core.bounds, ...pt })) continue;
    const index = localIndex({ bounds: core.bounds, ...pt });
    if (core.buffers.tiles[index] === TILE.Floor) core.buffers.roomIds[index] = core.id;
  }
}
