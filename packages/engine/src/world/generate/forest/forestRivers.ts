import { hashString, mixSeeds } from "../../../core/rng.js";
import { TILE } from "../../core/types.js";
import { forEachCell, insideBounds, localIndex } from "../finiteFloorBuffers.js";
import type { FloorBounds, FloorBuffers, FloorPoint, FloorRect, GeneratedFeatureStamp } from "../finiteFloorTypes.js";
import { buildRingOffsets, clampCoord, hasOwnedRoomOrFeature, insideProtectedFeatureArea, nearSpawn, smoothNoise2D } from "./forestNoise.js";

export interface ForestLayoutInput {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly seed: number;
  readonly spawn: FloorPoint;
  readonly featureStamps: readonly GeneratedFeatureStamp[];
  readonly sealedArenas: readonly FloorRect[];
}

interface RiverSpec {
  readonly axis: "horizontal" | "vertical";
  readonly riverSeed: number;
  readonly baseOffset: number;
  readonly phase: number;
}

const MIN_RIVER_SPAN = 48;
const RIVER_HALF_WIDTH = 1;
const SAND_BANK_RADIUS = 2;
const BRIDGE_STRIDE = 26;
const BRIDGE_HALF_LEN = 1;
const WATER_LEVEL = -0.5;
const BANK_LEVEL = -0.25;
const SAND_BANK_OFFSETS: readonly FloorPoint[] = buildRingOffsets(SAND_BANK_RADIUS, true);

export function placeForestRivers(input: ForestLayoutInput): void {
  const { bounds, seed, spawn } = input;
  if (bounds.width < MIN_RIVER_SPAN || bounds.height < MIN_RIVER_SPAN) return;
  const riverSeed = mixSeeds(seed, hashString("forest-rivers"));
  for (const spec of buildRiverSpecs(bounds, spawn, riverSeed)) carveSingleRiver(input, spec);
  paintSandyRiverbanks(input);
}

function buildRiverSpecs(bounds: FloorBounds, spawn: FloorPoint, riverSeed: number): RiverSpec[] {
  const midX = Math.floor((bounds.minX + bounds.maxX) / 2);
  const midY = Math.floor((bounds.minY + bounds.maxY) / 2);
  return [
    {
      axis: "horizontal",
      riverSeed: mixSeeds(riverSeed, 11),
      baseOffset: spawn.y >= midY ? midY - Math.floor(bounds.height * 0.22) : midY + Math.floor(bounds.height * 0.22),
      phase: (riverSeed % 100) * 0.06,
    },
    {
      axis: "vertical",
      riverSeed: mixSeeds(riverSeed, 29),
      baseOffset: spawn.x >= midX ? midX - Math.floor(bounds.width * 0.22) : midX + Math.floor(bounds.width * 0.22),
      phase: ((riverSeed >>> 8) % 100) * 0.06,
    },
  ];
}

function carveSingleRiver(input: ForestLayoutInput, spec: RiverSpec): void {
  const isHoriz = spec.axis === "horizontal";
  const start = (isHoriz ? input.bounds.minX : input.bounds.minY) + 8;
  const end = (isHoriz ? input.bounds.maxX : input.bounds.maxY) - 8;
  let prevCenter = riverCenterCoord(input.bounds, spec, start);
  for (let t = start; t <= end; t++) {
    const center = riverCenterCoord(input.bounds, spec, t);
    const bridge = isBridgeSlice({ input, spec, t, start, center });
    const minC = Math.min(prevCenter, center) - RIVER_HALF_WIDTH;
    const maxC = Math.max(prevCenter, center) + RIVER_HALF_WIDTH;
    for (let c = minC; c <= maxC; c++) stampRiverCell(input, riverPoint(spec.axis, t, c), bridge);
    prevCenter = center;
  }
}

function riverCenterCoord(bounds: FloorBounds, spec: RiverSpec, t: number): number {
  const isHoriz = spec.axis === "horizontal";
  const wave = Math.sin(t * 0.04 + spec.phase) * 16;
  const noise = (smoothNoise2D({ seed: spec.riverSeed, x: t, y: spec.baseOffset, scale: 24 }) - 0.5) * 14;
  const min = (isHoriz ? bounds.minY : bounds.minX) + 10;
  const max = (isHoriz ? bounds.maxY : bounds.maxX) - 10;
  return clampCoord(Math.round(spec.baseOffset + wave + noise), min, max);
}

function isBridgeSlice(slice: {
  readonly input: ForestLayoutInput;
  readonly spec: RiverSpec;
  readonly t: number;
  readonly start: number;
  readonly center: number;
}): boolean {
  const { input, spec, t, start, center } = slice;
  if ((t - start) % BRIDGE_STRIDE <= BRIDGE_HALF_LEN * 2) return true;
  for (let dt = -BRIDGE_HALF_LEN; dt <= BRIDGE_HALF_LEN; dt++) {
    if (sliceTouchesProtected({ input, spec, t: t + dt, center })) return true;
  }
  return false;
}

function sliceTouchesProtected(slice: {
  readonly input: ForestLayoutInput;
  readonly spec: RiverSpec;
  readonly t: number;
  readonly center: number;
}): boolean {
  const { input, spec, t, center } = slice;
  for (let w = -RIVER_HALF_WIDTH; w <= RIVER_HALF_WIDTH; w++) {
    const pt = riverPoint(spec.axis, t, center + w);
    if (!insideBounds({ bounds: input.bounds, ...pt })) continue;
    if (input.buffers.protectedCells[localIndex({ bounds: input.bounds, ...pt })] === 1) return true;
  }
  return false;
}

function riverPoint(axis: RiverSpec["axis"], t: number, cross: number): FloorPoint {
  return axis === "horizontal" ? { x: t, y: cross } : { x: cross, y: t };
}

function stampRiverCell(input: ForestLayoutInput, point: FloorPoint, bridge: boolean): void {
  if (!insideBounds({ bounds: input.bounds, ...point })) return;
  const index = localIndex({ bounds: input.bounds, ...point });
  if (!canPlaceRiverAt(input, point, index)) return;
  const existing = input.buffers.features[index] ?? TILE.Floor;
  if (existing === TILE.Bridge) return;
  const asBridge = bridge || input.buffers.protectedCells[index] === 1;
  const height = asBridge ? BANK_LEVEL : WATER_LEVEL;
  input.buffers.features[index] = asBridge ? TILE.Bridge : TILE.Water;
  input.buffers.height[index] = height;
  input.buffers.featureHeight[index] = height;
  input.buffers.territory[index] = 2;
}

function canPlaceRiverAt(input: ForestLayoutInput, point: FloorPoint, index: number): boolean {
  const { buffers, spawn, featureStamps, sealedArenas } = input;
  if (buffers.tiles[index] !== TILE.Floor) return false;
  const existing = buffers.features[index] ?? TILE.Floor;
  if (existing !== TILE.Floor && existing !== TILE.Water) return false;
  if (hasOwnedRoomOrFeature(buffers, index) || nearSpawn(point, spawn, 5)) return false;
  return !insideProtectedFeatureArea({ point, featureStamps, sealedArenas });
}

function paintSandyRiverbanks(input: ForestLayoutInput): void {
  forEachCell(input.bounds, (x, y, index) => {
    if (input.buffers.features[index] !== TILE.Water) return;
    for (const offset of SAND_BANK_OFFSETS) paintSandCell(input, { x: x + offset.x, y: y + offset.y });
  });
}

function paintSandCell(input: ForestLayoutInput, point: FloorPoint): void {
  if (!insideBounds({ bounds: input.bounds, ...point })) return;
  const index = localIndex({ bounds: input.bounds, ...point });
  if (input.buffers.tiles[index] !== TILE.Floor || input.buffers.features[index] === TILE.Water) return;
  if (insideProtectedFeatureArea({ point, featureStamps: input.featureStamps, sealedArenas: input.sealedArenas })) return;
  input.buffers.territory[index] = 2;
  if ((input.buffers.protectedCells[index] ?? 0) === 0 && input.buffers.features[index] === TILE.Floor) {
    input.buffers.height[index] = BANK_LEVEL;
  }
}
