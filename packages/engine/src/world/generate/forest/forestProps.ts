import { hash2DFloat, hashString, mixSeeds } from "../../../core/rng.js";
import { SOLID_TILES, TILE } from "../../core/types.js";
import { forEachCell, insideBounds, localIndex } from "../finiteFloorBuffers.js";
import type { FloorBounds, FloorBuffers, FloorPoint } from "../finiteFloorTypes.js";
import { buildRingOffsets, hasOwnedRoomOrFeature, insideProtectedFeatureArea, nearSpawn, smoothNoise2D } from "./forestNoise.js";
import type { ForestLayoutInput } from "./forestRivers.js";

const RING_1_OFFSETS = buildRingOffsets(1, false);
const RING_2_OFFSETS = buildRingOffsets(2, true);

export function placeForestProps(input: ForestLayoutInput): void {
  const groveSeed = mixSeeds(input.seed, hashString("forest-groves"));
  const propSeed = mixSeeds(input.seed, hashString("forest-props"));
  forEachCell(input.bounds, (x, y, index) => {
    const point = { x, y };
    if (!isPropEligible(input, point, index)) return;
    const prop = chooseForestProp({ input, point, groveSeed, propSeed });
    if (prop === TILE.Floor) return;
    input.buffers.features[index] = prop;
    input.buffers.featureHeight[index] = input.buffers.height[index] ?? 0;
  });
}

function isPropEligible(input: ForestLayoutInput, point: FloorPoint, index: number): boolean {
  const { buffers, bounds, spawn, featureStamps, sealedArenas } = input;
  if (buffers.tiles[index] !== TILE.Floor || buffers.features[index] !== TILE.Floor) return false;
  if ((buffers.protectedCells[index] ?? 0) !== 0 || hasOwnedRoomOrFeature(buffers, index)) return false;
  if (nearSpawn(point, spawn, 5) || insideProtectedFeatureArea({ point, featureStamps, sealedArenas })) return false;
  return !RING_2_OFFSETS.some((offset) => isProtectedApproachFeature(buffers, bounds, offsetPoint(point, offset)));
}

function chooseForestProp(context: {
  readonly input: ForestLayoutInput;
  readonly point: FloorPoint;
  readonly groveSeed: number;
  readonly propSeed: number;
}): number {
  const { input, point, groveSeed, propSeed } = context;
  const grove = smoothNoise2D({ seed: groveSeed, x: point.x, y: point.y, scale: 14 });
  const roll = hash2DFloat(propSeed, point.x, point.y);
  const spaced = !hasNearbyForestProp(input.buffers, input.bounds, point);
  if (!spaced) return TILE.Floor;
  if (isTreeSpot({ input, point, grove, roll })) return TILE.Tree;
  if (isBushSpot({ input, point, grove, roll })) return TILE.Bush;
  return isBoulderSpot({ input, point, roll }) ? TILE.Boulder : TILE.Floor;
}

function isTreeSpot(input: {
  readonly input: ForestLayoutInput;
  readonly point: FloorPoint;
  readonly grove: number;
  readonly roll: number;
}): boolean {
  const index = localIndex({ bounds: input.input.bounds, ...input.point });
  return input.input.buffers.territory[index] !== 2
    && input.grove >= 0.58
    && input.roll < 0.08
    && canPlaceSolidProp(input.input.buffers, input.input.bounds, input.point);
}

function isBoulderSpot(input: {
  readonly input: ForestLayoutInput;
  readonly point: FloorPoint;
  readonly roll: number;
}): boolean {
  return input.roll < 0.05
    && canPlaceSolidProp(input.input.buffers, input.input.bounds, input.point)
    && nearWall(input.input.buffers, input.input.bounds, input.point);
}

function isBushSpot(input: {
  readonly input: ForestLayoutInput;
  readonly point: FloorPoint;
  readonly grove: number;
  readonly roll: number;
}): boolean {
  return input.roll < 0.045 && (input.grove >= 0.48 || nearWater(input.input.buffers, input.input.bounds, input.point));
}

function isProtectedApproachFeature(buffers: FloorBuffers, bounds: FloorBounds, point: FloorPoint): boolean {
  if (!insideBounds({ bounds, ...point })) return false;
  const feature = buffers.features[localIndex({ bounds, ...point })] ?? TILE.Floor;
  return feature === TILE.Bridge || feature === TILE.Stairs || (feature >= TILE.DoorPersonal && feature <= TILE.DoorSafeRoom);
}

function hasNearbyForestProp(buffers: FloorBuffers, bounds: FloorBounds, point: FloorPoint): boolean {
  return RING_2_OFFSETS.some((offset) => {
    const neighbor = offsetPoint(point, offset);
    if (!insideBounds({ bounds, ...neighbor })) return false;
    const feature = buffers.features[localIndex({ bounds, ...neighbor })] ?? TILE.Floor;
    return feature === TILE.Tree || feature === TILE.Bush || feature === TILE.Boulder;
  });
}

function canPlaceSolidProp(buffers: FloorBuffers, bounds: FloorBounds, point: FloorPoint): boolean {
  return !RING_1_OFFSETS.some((offset) => blocksSolidNeighbor(buffers, bounds, offsetPoint(point, offset)));
}

function blocksSolidNeighbor(buffers: FloorBuffers, bounds: FloorBounds, point: FloorPoint): boolean {
  if (!insideBounds({ bounds, ...point })) return true;
  const index = localIndex({ bounds, ...point });
  return buffers.tiles[index] !== TILE.Floor || SOLID_TILES.has(buffers.features[index] ?? TILE.Floor);
}

function nearWater(buffers: FloorBuffers, bounds: FloorBounds, point: FloorPoint): boolean {
  return RING_1_OFFSETS.some((offset) => {
    const neighbor = offsetPoint(point, offset);
    return insideBounds({ bounds, ...neighbor }) && buffers.features[localIndex({ bounds, ...neighbor })] === TILE.Water;
  });
}

function nearWall(buffers: FloorBuffers, bounds: FloorBounds, point: FloorPoint): boolean {
  return RING_2_OFFSETS.some((offset) => {
    const neighbor = offsetPoint(point, offset);
    return insideBounds({ bounds, ...neighbor }) && buffers.tiles[localIndex({ bounds, ...neighbor })] !== TILE.Floor;
  });
}

function offsetPoint(point: FloorPoint, offset: FloorPoint): FloorPoint {
  return { x: point.x + offset.x, y: point.y + offset.y };
}
