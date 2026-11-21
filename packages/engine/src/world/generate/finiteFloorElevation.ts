import { FEATURE_FACE, TILE } from "../core/types.js";
import { forEachCell, insideBounds, isCarved, localIndex } from "./finiteFloorBuffers.js";
import type { FloorBounds, FloorBuffers, GeneratedMiniBossArena, GeneratedSafeRoomEntrance, GeneratedStairway } from "./finiteFloorTypes.js";
import { isOrdinarySurface, ordinarySurfaceTouchesBoundary, ordinaryVisibilityMarginHeight } from "./elevation/ordinaryElevationVisibility.js";

const ELEVATION_BAND_WIDTH = 8;

interface ElevationInput {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly safeRooms: readonly GeneratedSafeRoomEntrance[];
  readonly stairways: { readonly down: readonly GeneratedStairway[]; readonly up: GeneratedStairway | null };
  readonly miniBossArenas: readonly GeneratedMiniBossArena[];
  readonly shapeOrdinaryWallMargins?: boolean;
  readonly elevationStep: number;
  readonly minimumElevation: number;
  readonly maximumElevation: number;
}

interface PlatformRamp { readonly x: number; readonly y: number; readonly height: number; }
interface ElevationTraversal {
  readonly input: ElevationInput; readonly index: number;
  readonly distances: Int32Array; readonly queue: number[];
}
interface RampGeometry {
  readonly ramp: { x: number; y: number }; readonly high: { x: number; y: number };
  readonly low: { x: number; y: number };
}
interface RampInput extends RampGeometry {
  readonly input: ElevationInput; readonly highHeight: number;
  readonly stampSideLandings?: boolean;
}

/** Applies coherent ordinary elevations before restoring authored feature ramps. */
export function applyElevationTransitions(input: ElevationInput): void {
  applyOrdinaryElevations(input);
  applyFeatureElevationRamps(input);
}

/** Stamps stairway and mini-boss arena platform ramps onto the current terrain. */
export function applyFeatureElevationRamps(input: ElevationInput): void {
  for (const stairway of input.stairways.down) stampStairwayRamp(input, stairway);
  if (input.stairways.up) stampStairwayRamp(input, input.stairways.up);
  for (const arena of input.miniBossArenas) {
    for (const platform of arena.platforms) stampPlatformRamp(input, platform);
  }
}

function applyOrdinaryElevations(input: ElevationInput): void {
  const distances = distancesFromAuthoredSurfaces(input);
  forEachCell(input.bounds, (_x, _y, index) => {
    const distance = distances[index] ?? -1;
    if (distance < 0 || !isOrdinarySurface(input.buffers, index)) return;
    const height = ordinaryHeight(input, distance);
    input.buffers.height[index] = input.shapeOrdinaryWallMargins
      ? ordinaryVisibilityMarginHeight({ buffers: input.buffers, bounds: input.bounds, index, height })
      : height;
  });
}

function distancesFromAuthoredSurfaces(input: ElevationInput): Int32Array {
  const distances = new Int32Array(input.buffers.tiles.length).fill(-1);
  const queue: number[] = [];
  for (let index = 0; index < distances.length; index++) {
    if (!isElevationAnchor(input, index)) continue;
    distances[index] = 0;
    queue.push(index);
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    if (index !== undefined) enqueueNeighbors({ input, index, distances, queue });
  }
  return distances;
}

function enqueueNeighbors(state: ElevationTraversal): void {
  const { width } = state.input.bounds;
  const x = state.index % width;
  if (x > 0) enqueueSurface(state, state.index - 1);
  if (x + 1 < width) enqueueSurface(state, state.index + 1);
  enqueueSurface(state, state.index - width);
  enqueueSurface(state, state.index + width);
}

function enqueueSurface(state: ElevationTraversal, neighbor: number): void {
  if (neighbor < 0 || neighbor >= state.distances.length) return;
  if (state.distances[neighbor] !== -1 || !isCarved(state.input.buffers, neighbor)) return;
  state.distances[neighbor] = (state.distances[state.index] ?? 0) + 1;
  state.queue.push(neighbor);
}

function isElevationAnchor(input: ElevationInput, index: number): boolean {
  const buffers = input.buffers;
  if (!isCarved(buffers, index)) return false;
  if (input.shapeOrdinaryWallMargins && ordinarySurfaceTouchesBoundary(buffers, input.bounds, index)) return true;
  return !isOrdinarySurface(buffers, index)
    || buffers.features[index] !== TILE.Floor
    || buffers.height[index] !== 0;
}

function ordinaryHeight(input: ElevationInput, distance: number): number {
  const level = Math.floor(distance / ELEVATION_BAND_WIDTH);
  const step = Math.min(1, input.elevationStep);
  const anchoredHeight = Math.min(0, input.maximumElevation);
  return Math.max(input.minimumElevation, anchoredHeight - level * step);
}

function stampStairwayRamp(input: ElevationInput, stairway: GeneratedStairway): void {
  const { x, y } = stairway.position;
  stampRamp({
    input,
    ramp: { x, y },
    high: { x, y: y - 1 },
    low: { x, y: y + 1 },
    highHeight: input.elevationStep,
    stampSideLandings: true,
  });
}

function stampPlatformRamp(input: ElevationInput, platform: PlatformRamp): void {
  stampRamp({
    input,
    ramp: { x: platform.x, y: platform.y - 1 },
    high: platform,
    low: { x: platform.x, y: platform.y - 2 },
    highHeight: platform.height,
    stampSideLandings: true,
  });
}

function stampRamp(input: RampInput): void {
  const { buffers, bounds } = input.input;
  if (!rampCellsUsable(input.input, input)) return;
  const rampIndex = localIndex({ bounds, ...input.ramp });
  const highIndex = localIndex({ bounds, ...input.high });
  const lowIndex = localIndex({ bounds, ...input.low });
  buffers.height[highIndex] = input.highHeight;
  buffers.height[lowIndex] = 0;
  buffers.tiles[rampIndex] = TILE.Floor;
  buffers.features[rampIndex] = TILE.Stairs;
  buffers.featureFaces[rampIndex] = FEATURE_FACE.North;
  buffers.featureHeight[rampIndex] = input.highHeight / 2;
  buffers.height[rampIndex] = input.highHeight / 2;
  if (input.stampSideLandings) {
    stampRampLanding({ buffers, bounds, x: input.ramp.x - 1, y: input.ramp.y, height: input.highHeight / 2 });
    stampRampLanding({ buffers, bounds, x: input.ramp.x + 1, y: input.ramp.y, height: input.highHeight / 2 });
  }
}

function rampCellsUsable(input: ElevationInput, ramp: RampGeometry): boolean {
  const { buffers, bounds } = input;
  const points = [ramp.ramp, ramp.high, ramp.low];
  if (!points.every((point) => insideBounds({ bounds, ...point }))) return false;
  const indices = points.map((point) => localIndex({ bounds, ...point }));
  return indices.every((index) => (buffers.roomWallIds[index] ?? -1) < 0 && isCarved(buffers, index));
}

function stampRampLanding(input: {
  readonly buffers: FloorBuffers; readonly bounds: FloorBounds;
  readonly x: number; readonly y: number; readonly height: number;
}): void {
  if (!insideBounds(input)) return;
  const index = localIndex(input);
  if (isCarved(input.buffers, index) && (input.buffers.roomWallIds[index] ?? -1) < 0) input.buffers.height[index] = input.height;
}
