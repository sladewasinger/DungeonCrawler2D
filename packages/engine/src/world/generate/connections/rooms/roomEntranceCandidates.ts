import { hash2D } from "../../../../core/rng.js";
import { insideBounds, isCarved, localIndex } from "../../finiteFloorBuffers.js";
import type { FloorBounds, FloorBuffers, FloorPoint, GeneratedRoom } from "../../finiteFloorTypes.js";

interface CandidateInput { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly width: number; }
export interface EntranceCandidate { readonly wall: readonly FloorPoint[]; readonly outside: readonly FloorPoint[]; readonly approach: readonly FloorPoint[]; readonly axis: "horizontal" | "vertical"; readonly region: number; }
interface RoomSide { readonly axis: "horizontal" | "vertical"; readonly wall: (offset: number) => FloorPoint; readonly inside: (offset: number) => FloorPoint; readonly outside: (offset: number) => FloorPoint; }

export function roomSides(room: GeneratedRoom): readonly RoomSide[] {
  return [
    { axis: "horizontal", wall: (offset) => ({ x: room.center.x + offset, y: room.y0 - 1 }), inside: (offset) => ({ x: room.center.x + offset, y: room.y0 }), outside: (offset) => ({ x: room.center.x + offset, y: room.y0 - 2 }) },
    { axis: "horizontal", wall: (offset) => ({ x: room.center.x + offset, y: room.y1 + 1 }), inside: (offset) => ({ x: room.center.x + offset, y: room.y1 }), outside: (offset) => ({ x: room.center.x + offset, y: room.y1 + 2 }) },
    { axis: "vertical", wall: (offset) => ({ x: room.x0 - 1, y: room.center.y + offset }), inside: (offset) => ({ x: room.x0, y: room.center.y + offset }), outside: (offset) => ({ x: room.x0 - 2, y: room.center.y + offset }) },
    { axis: "vertical", wall: (offset) => ({ x: room.x1 + 1, y: room.center.y + offset }), inside: (offset) => ({ x: room.x1, y: room.center.y + offset }), outside: (offset) => ({ x: room.x1 + 2, y: room.center.y + offset }) },
  ];
}
export function sideCandidates(input: CandidateInput, room: GeneratedRoom, side: RoomSide): EntranceCandidate[] { return [-1, 0, 1, 2, -2].flatMap((offset) => candidateForOffset({ input, room, side, offset })); }
function candidateForOffset(input: { readonly input: CandidateInput; readonly room: GeneratedRoom; readonly side: RoomSide; readonly offset: number }): EntranceCandidate[] {
  const widths = input.input.width === 2 ? [2, 1] : [1];
  return widths.flatMap((width) => candidateForWidth({ ...input, width }));
}
function candidateForWidth(input: { readonly input: CandidateInput; readonly room: GeneratedRoom; readonly side: RoomSide; readonly offset: number; readonly width: number }): EntranceCandidate[] {
  const offsets = [input.offset, ...(input.width === 2 ? [input.offset + 1] : [])];
  const wall = offsets.map(input.side.wall); const inside = offsets.map(input.side.inside); const outside = offsets.map(input.side.outside);
  if (!wall.every((point) => roomWallAt(input.input, input.room, point)) || !inside.every((point) => insideRoom(input.input, input.room, point))) return [];
  const connection = externalConnection(input.input, wall, outside);
  return connection ? [{ wall, outside, axis: input.side.axis, ...connection }] : [];
}
function roomWallAt(input: CandidateInput, room: GeneratedRoom, point: FloorPoint): boolean { return insideBounds({ bounds: input.bounds, ...point }) && input.buffers.roomWallIds[localIndex({ bounds: input.bounds, ...point })] === room.id; }
function externalConnection(input: CandidateInput, wall: readonly FloorPoint[], outside: readonly FloorPoint[]): { readonly approach: readonly FloorPoint[]; readonly region: number } | null {
  const wallStart = wall[0]; const outsideStart = outside[0]; if (!wallStart || !outsideStart) return null;
  const direction = { x: outsideStart.x - wallStart.x, y: outsideStart.y - wallStart.y };
  for (let distance = 0; distance <= Math.max(input.bounds.width, input.bounds.height); distance++) {
    const connection = connectionAtDistance({ input, outside, direction, distance }); if (connection) return connection;
  }
  return null;
}
function connectionAtDistance(input: { readonly input: CandidateInput; readonly outside: readonly FloorPoint[]; readonly direction: FloorPoint; readonly distance: number }): { readonly approach: readonly FloorPoint[]; readonly region: number } | null {
  const targets = input.outside.map((point) => shift(point, input.direction, input.distance)); if (!targets.every((point) => insideBounds({ bounds: input.input.bounds, ...point }))) return null;
  const target = targets.find((point) => isCarvedAt(input.input, point)); if (!target) return null;
  const region = input.input.buffers.region[localIndex({ bounds: input.input.bounds, ...target })] ?? 0; if (region <= 0) return null;
  const approach = input.outside.flatMap((point) => lineToTarget(point, shift(point, input.direction, input.distance), input.direction));
  return approach.every((point) => clearApproach(input.input, point)) ? { approach, region } : null;
}
function isCarvedAt(input: CandidateInput, point: FloorPoint): boolean { return insideBounds({ bounds: input.bounds, ...point }) && isCarved(input.buffers, localIndex({ bounds: input.bounds, ...point })) && (input.buffers.roomWallIds[localIndex({ bounds: input.bounds, ...point })] ?? -1) < 0; }
function lineToTarget(start: FloorPoint, target: FloorPoint, direction: FloorPoint): FloorPoint[] { const length = Math.abs(target.x - start.x) + Math.abs(target.y - start.y); return Array.from({ length: length + 1 }, (_, distance) => ({ x: start.x + direction.x * distance, y: start.y + direction.y * distance })); }
function clearApproach(input: CandidateInput, point: FloorPoint): boolean { if (!insideBounds({ bounds: input.bounds, ...point })) return false; const index = localIndex({ bounds: input.bounds, ...point }); return (input.buffers.roomWallIds[index] ?? -1) < 0 && (!(input.buffers.protectedCells[index] ?? 0) || isCarved(input.buffers, index)); }
function insideRoom(input: CandidateInput, room: GeneratedRoom, point: FloorPoint): boolean { return insideBounds({ bounds: input.bounds, ...point }) && isCarved(input.buffers, localIndex({ bounds: input.bounds, ...point })) && input.buffers.roomIds[localIndex({ bounds: input.bounds, ...point })] === room.id; }
function shift(point: FloorPoint, direction: FloorPoint, distance: number): FloorPoint { return { x: point.x + direction.x * distance, y: point.y + direction.y * distance }; }
export function candidateOrder(seed: number, left: EntranceCandidate, right: EntranceCandidate): number {
  const a = left.wall[0];
  const b = right.wall[0];
  if (!a || !b) return left.wall.length - right.wall.length;
  return hash2D(seed, a.x, a.y) - hash2D(seed, b.x, b.y) || a.y - b.y || a.x - b.x;
}
