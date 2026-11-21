import { JUMP_VELOCITY, GRAVITY, STEP_UP } from "../../core/constants.js";
import { transitionAt } from "../../navigation/gridPathTransition.js";
import { stairRampAt } from "../stairs/stairs.js";
import { SOLID_TILES, TERRAIN, TILE, type WorldView } from "../core/types.js";
import { forEachCell, insideBounds, localIndex } from "./finiteFloorBuffers.js";
import type { FloorAttempt, FloorBounds, FloorBuffers, FloorPoint } from "./finiteFloorTypes.js";

const MAX_GENERATED_JUMP = (JUMP_VELOCITY ** 2) / (2 * GRAVITY);

interface MovementContext {
  readonly view: WorldView;
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
}

export interface FloorMovementAnalysis {
  readonly view: WorldView;
  readonly reachable: Uint8Array;
  readonly failures: readonly string[];
  readonly edgeIsLegal: (from: FloorPoint, to: FloorPoint) => boolean;
}

export function analyzeFloorMovement(attempt: Pick<FloorAttempt, "buffers" | "spawn">, bounds: FloorBounds): FloorMovementAnalysis {
  const view = movementView(attempt.buffers, bounds);
  const context = { view, buffers: attempt.buffers, bounds };
  const failures: string[] = [];
  forEachCell(bounds, (x, y, index) => {
    if (isMovementWalkable(attempt.buffers, index)) validateForwardEdges(context, { x, y }, failures);
  });
  const reachable = movementReachability(attempt.spawn, context);
  return {
    view, reachable, failures: failures.slice(0, 8),
    edgeIsLegal: (from, to) => movementEdgeIsLegal(context, from, to),
  };
}

function validateForwardEdges(context: MovementContext, point: FloorPoint, failures: string[]): void {
  validateNeighborEdge({ context, from: point, to: { x: point.x + 1, y: point.y }, failures });
  validateNeighborEdge({ context, from: point, to: { x: point.x, y: point.y + 1 }, failures });
}

function validateNeighborEdge(input: {
  readonly context: MovementContext;
  readonly from: FloorPoint;
  readonly to: FloorPoint;
  readonly failures: string[];
}): void {
  const { context, from, to, failures } = input;
  if (!insideBounds({ bounds: context.bounds, ...to })) return;
  const next = localIndex({ bounds: context.bounds, ...to });
  if (!isMovementWalkable(context.buffers, next)) return;
  recordIllegalEdge({ context, from, to, failures });
  recordIllegalEdge({ context, from: to, to: from, failures });
}

function recordIllegalEdge(input: { readonly context: MovementContext; readonly from: FloorPoint; readonly to: FloorPoint; readonly failures: string[] }): void {
  if (!movementEdgeIsLegal(input.context, input.from, input.to)) input.failures.push(`illegal movement edge ${input.from.x},${input.from.y}->${input.to.x},${input.to.y}`);
}

export function isMovementWalkable(buffers: FloorBuffers, index: number): boolean {
  return buffers.tiles[index] === TILE.Floor
    && !SOLID_TILES.has(buffers.features[index] ?? TILE.Floor)
    && !SOLID_TILES.has(buffers.tiles[index] ?? TILE.Floor)
    && buffers.terrain[index] !== TERRAIN.Void;
}

function movementView(buffers: FloorBuffers, bounds: FloorBounds): WorldView & { tileAt: (x: number, y: number) => number } {
  const view = {
    tileAt: (x: number, y: number) => tileAt({ buffers, bounds, x, y }),
    isWalkable: (x: number, y: number) => insideBounds({ bounds, x, y }) && isMovementWalkable(buffers, localIndex({ bounds, x, y })),
    heightAt: (x: number, y: number) => heightAt({ buffers, bounds, x, y }),
    groundAt: (x: number, y: number) => stairRampAt(view, x, y) ?? heightAt({ buffers, bounds, x: Math.floor(x), y: Math.floor(y) }),
    stairHeightAt: (x: number, y: number) => tileAt({ buffers, bounds, x: Math.floor(x), y: Math.floor(y) }) === TILE.Stairs ? stairRampAt(view, x, y) : null,
  };
  return view;
}

function movementEdgeIsLegal(context: MovementContext, from: FloorPoint, to: FloorPoint): boolean {
  return runtimeEdgeIsTraversable(context, from, to);
}

function runtimeEdgeIsTraversable(context: MovementContext, from: FloorPoint, to: FloorPoint): boolean {
  const fromIndex = localIndex({ bounds: context.bounds, ...from });
  const toIndex = localIndex({ bounds: context.bounds, ...to });
  const stairs = context.buffers.features[fromIndex] === TILE.Stairs || context.buffers.features[toIndex] === TILE.Stairs;
  if (!stairs) return (context.buffers.height[toIndex] ?? 0) - (context.buffers.height[fromIndex] ?? 0) <= MAX_GENERATED_JUMP;
  return transitionAt({
    world: context.view, options: {},
    limits: { maxJumpRise: MAX_GENERATED_JUMP, jumpThreshold: STEP_UP }, from, to,
  }) !== null;
}

function movementReachability(start: FloorPoint, context: MovementContext): Uint8Array {
  const reachable = new Uint8Array(context.buffers.tiles.length);
  const startPoint = { x: Math.floor(start.x), y: Math.floor(start.y) };
  if (!insideBounds({ bounds: context.bounds, ...startPoint })) return reachable;
  const startIndex = localIndex({ bounds: context.bounds, ...startPoint });
  if (!isMovementWalkable(context.buffers, startIndex)) return reachable;
  const queue = [startPoint];
  reachable[startIndex] = 1;
  for (let cursor = 0; cursor < queue.length; cursor++) expandReachability({ queue, cursor, reachable, context });
  return reachable;
}

function expandReachability(input: { readonly queue: FloorPoint[]; readonly cursor: number; readonly reachable: Uint8Array; readonly context: MovementContext }): void {
  const point = input.queue[input.cursor];
  if (!point) return;
  for (const direction of CARDINAL_DIRECTIONS) {
    const next = { x: point.x + direction.x, y: point.y + direction.y };
    if (!insideBounds({ bounds: input.context.bounds, ...next })) continue;
    const index = localIndex({ bounds: input.context.bounds, ...next });
    if (input.reachable[index] || !isMovementWalkable(input.context.buffers, index) || !runtimeEdgeIsTraversable(input.context, point, next)) continue;
    input.reachable[index] = 1;
    input.queue.push(next);
  }
}

const CARDINAL_DIRECTIONS = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
] as const;

function tileAt(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly x: number; readonly y: number }): number {
  if (!insideBounds(input)) return TILE.Void;
  const index = localIndex(input);
  const feature = input.buffers.features[index] ?? TILE.Floor;
  return feature !== TILE.Floor ? feature : input.buffers.tiles[index] ?? TILE.Void;
}

function heightAt(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly x: number; readonly y: number }): number {
  if (!insideBounds(input)) return 0;
  return input.buffers.height[localIndex(input)] ?? 0;
}
