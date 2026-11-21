import { hash2D } from "../../core/rng.js";
import { carveAt, isCarved, localIndex } from "./finiteFloorBuffers.js";
import { territoryProfile } from "./territories/territoryCatalog.js";
import { corridorCells, insideMaze, mazeCellTouchesAnotherRegion, mazeDirections } from "./finiteFloorMaze.js";
import { admitMazeCrossings } from "./connections/bridges/finiteMazeCrossings.js";
import {
  FLOOR_SEMANTIC,
  type FloorBounds,
  type FloorBuffers,
  type FloorPoint,
  type NormalizedFloorGenerationConfig,
} from "./finiteFloorTypes.js";

interface MazeInput {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly seed: number;
  readonly config: NormalizedFloorGenerationConfig;
}

export interface GeneratedMazeSegment {
  readonly start: FloorPoint;
  readonly end: FloorPoint;
  readonly cells: readonly FloorPoint[];
  readonly width: number;
  readonly regionId: number;
}

export interface MazeGenerationResult {
  readonly nextRegionId: number;
  readonly segments: readonly GeneratedMazeSegment[];
  readonly widths: readonly number[];
  readonly crossings: ReturnType<typeof admitMazeCrossings>["connectors"];
  readonly crossingRegionLinks: ReturnType<typeof admitMazeCrossings>["regionLinks"];
}

interface MazeStep extends FloorPoint {
  readonly direction: FloorPoint;
  readonly width: number;
  readonly cells: readonly FloorPoint[];
}

interface MazeCursor {
  readonly point: FloorPoint;
  readonly direction: FloorPoint | null;
}

export function growMaze(input: MazeInput & { readonly firstRegionId: number }): MazeGenerationResult {
  const segments: GeneratedMazeSegment[] = [];
  let regionId = input.firstRegionId;
  const stride = input.config.mazeCorridorWidth + 1;
  const margin = input.config.mazeCorridorWidth;
  for (let y = input.bounds.minY + margin; y <= input.bounds.maxY - margin; y += stride) {
    regionId = growMazeRow(input, { y, regionId, stride, segments });
  }
  const crossings = admitMazeCrossings({
    buffers: input.buffers, bounds: input.bounds, seed: input.seed,
    width: input.config.roomEntranceWidth,
  });
  return {
    nextRegionId: regionId, segments, widths: segments.map(({ width }) => width),
    crossings: crossings.connectors, crossingRegionLinks: crossings.regionLinks,
  };
}

function growMazeRow(input: MazeInput, state: {
  readonly y: number;
  readonly regionId: number;
  readonly stride: number;
  readonly segments: GeneratedMazeSegment[];
}): number {
  let regionId = state.regionId;
  const margin = Math.ceil(input.config.mazeCorridorWidth / 2) + 1;
  for (let x = input.bounds.minX + margin; x <= input.bounds.maxX - margin; x += state.stride) {
    const index = localIndex({ bounds: input.bounds, x, y: state.y });
    if (!mazeStartAvailable(input, index)) continue;
    if (hash2D(input.seed, x, state.y) / 0x1_0000_0000 > input.config.mazeDensity) continue;
    if (growMazeRegion({ ...input, start: { x, y: state.y }, regionId, stride: state.stride, segments: state.segments })) regionId++;
  }
  return regionId;
}
function mazeStartAvailable(input: MazeInput, index: number): boolean { return !isCarved(input.buffers, index) && !(input.buffers.protectedCells[index] ?? 0) && (input.buffers.roomWallIds[index] ?? -1) < 0; }
function growMazeRegion(input: MazeInput & {
  readonly start: FloorPoint;
  readonly regionId: number;
  readonly stride: number;
  readonly segments: GeneratedMazeSegment[];
}): boolean {
  const start = { point: input.start, direction: null };
  if (mazeCandidates(input, start).length === 0) return false;
  const stack: MazeCursor[] = [start];
  while (stack.length > 0) advanceMaze(input, stack);
  return true;
}
function advanceMaze(input: MazeInput & {
  readonly regionId: number;
  readonly stride: number;
  readonly segments: GeneratedMazeSegment[];
}, stack: MazeCursor[]): void {
  const current = stack[stack.length - 1];
  if (!current) return;
  const candidates = mazeCandidates(input, current);
  if (candidates.length === 0) { stack.pop(); return; }
  const next = chooseMazeStep(input, current, candidates);
  carveMazeStep(input, current.point, next);
  input.segments.push({ start: current.point, end: next, cells: next.cells, width: next.width, regionId: input.regionId });
  stack.push({ point: next, direction: next.direction });
}
function chooseMazeStep(input: MazeInput, current: MazeCursor, candidates: readonly MazeStep[]): MazeStep {
  const territory = input.buffers.territory[localIndex({ bounds: input.bounds, ...current.point })] ?? 0;
  const territoryId = input.config.territoryRoster[territory] ?? input.config.territoryRoster[0];
  const direction = current.direction;
  const straight = direction
    ? candidates.find((candidate) => sameDirection(candidate.direction, direction))
    : undefined;
  const roll = hash2D(input.seed, current.point.x, current.point.y) / 0x1_0000_0000;
  const first = candidates[0];
  if (!first) throw new Error("maze candidate selection produced no candidate");
  return straight && territoryId && roll < territoryProfile(territoryId).straightChance ? straight : first;
}
function mazeCandidates(input: MazeInput & { readonly regionId: number; readonly stride: number }, current: MazeCursor): MazeStep[] { return mazeDirections(input.seed, current.point).map((direction) => makeMazeStep(input, current.point, direction)).filter((candidate) => canCarveMazeStep(input, candidate)); }
function makeMazeStep(input: MazeInput & { readonly stride: number }, start: FloorPoint, direction: FloorPoint): MazeStep {
  const end = { x: start.x + direction.x * input.stride, y: start.y + direction.y * input.stride };
  const width = input.config.mazeCorridorWidth;
  return { ...end, direction, width, cells: corridorCells({ start, end, direction, width }) };
}
function canCarveMazeStep(input: MazeInput & { readonly regionId: number }, candidate: MazeStep): boolean {
  if (!insideMaze(input.bounds, candidate)) return false;
  const endIndex = localIndex({ bounds: input.bounds, ...candidate });
  if (isCarved(input.buffers, endIndex)) return false;
  return candidate.cells.every((point) => canCarveCell(input, point));
}
function canCarveCell(input: MazeInput & { readonly regionId: number }, point: FloorPoint): boolean {
  if (!insideMaze(input.bounds, point)) return false;
  const index = localIndex({ bounds: input.bounds, ...point });
  if (!mazeCellAvailable(input, index)) return false;
  return !mazeCellTouchesAnotherRegion(input, point);
}
function mazeCellAvailable(input: MazeInput & { readonly regionId: number }, index: number): boolean { return !(input.buffers.protectedCells[index] ?? 0) && (input.buffers.roomWallIds[index] ?? -1) < 0 && (!isCarved(input.buffers, index) || (input.buffers.region[index] ?? 0) === input.regionId); }
function carveMazeStep(input: MazeInput & { readonly regionId: number }, start: FloorPoint, step: MazeStep): void {
  for (const point of step.cells) {
    const index = localIndex({ bounds: input.bounds, ...point });
    if (!isCarved(input.buffers, index)) carveMazeCell(input, point);
  }
  carveMazeCell(input, start);
  carveMazeCell(input, step);
}
function carveMazeCell(input: MazeInput & { readonly regionId: number }, point: FloorPoint): void {
  carveAt({ buffers: input.buffers, bounds: input.bounds, point, semantic: FLOOR_SEMANTIC.Corridor, regionId: input.regionId });
}

function sameDirection(a: FloorPoint, b: FloorPoint): boolean { return a.x === b.x && a.y === b.y; }
