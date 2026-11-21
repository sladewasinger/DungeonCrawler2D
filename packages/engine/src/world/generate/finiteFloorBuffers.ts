import { TILE, TOPOLOGY } from "../core/types.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers, type FloorPoint, type FloorRect } from "./finiteFloorTypes.js";
import { materializeCell } from "./terrain/finiteFloorMaterialization.js";

export function createFloorBuffers(bounds: FloorBounds): FloorBuffers {
  const cells = bounds.width * bounds.height;
  return {
    tiles: new Uint8Array(cells).fill(TOPOLOGY.Uncarved),
    terrain: new Uint8Array(cells), features: new Uint8Array(cells),
    featureFaces: new Uint8Array(cells), featureHeight: new Float32Array(cells),
    height: new Float32Array(cells), zones: new Uint8Array(cells),
    semantic: new Uint8Array(cells), biome: new Uint8Array(cells), territory: new Uint8Array(cells),
    region: new Uint16Array(cells),
    protectedCells: new Uint8Array(cells), roomIds: new Int16Array(cells).fill(-1),
    roomWallIds: new Int16Array(cells).fill(-1),
    featureIds: new Int16Array(cells).fill(-1),
  };
}

export function localIndex(input: { readonly bounds: FloorBounds; readonly x: number; readonly y: number }): number {
  return (input.y - input.bounds.minY) * input.bounds.width + input.x - input.bounds.minX;
}
export function insideBounds(input: { readonly bounds: FloorBounds; readonly x: number; readonly y: number }): boolean {
  return input.x >= input.bounds.minX && input.x <= input.bounds.maxX &&
    input.y >= input.bounds.minY && input.y <= input.bounds.maxY;
}

export function forEachCell(
  bounds: FloorBounds,
  callback: (x: number, y: number, index: number) => void,
): void {
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) callback(x, y, localIndex({ bounds, x, y }));
  }
}
export function forEachRect(rect: FloorRect, callback: (x: number, y: number) => void): void {
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) callback(x, y);
  }
}
export function isCarved(buffers: FloorBuffers, index: number): boolean {
  return buffers.tiles[index] === TILE.Floor;
}
export function carveAt(input: {
  readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly point: FloorPoint;
  readonly semantic: number; readonly regionId: number; readonly roomId?: number;
}): void {
  if (!insideBounds({ bounds: input.bounds, x: input.point.x, y: input.point.y })) return;
  const carveInput = {
    buffers: input.buffers,
    index: localIndex({ bounds: input.bounds, x: input.point.x, y: input.point.y }),
    semantic: input.semantic,
    regionId: input.regionId,
    ...(input.roomId === undefined ? {} : { roomId: input.roomId }),
  };
  carveCell(carveInput);
}
export function carveCell(input: {
  readonly buffers: FloorBuffers; readonly index: number;
  readonly semantic: number; readonly regionId: number; readonly roomId?: number;
}): void {
  input.buffers.tiles[input.index] = TILE.Floor;
  input.buffers.semantic[input.index] = input.semantic;
  input.buffers.region[input.index] = input.regionId;
  if (input.roomId !== undefined) input.buffers.roomIds[input.index] = input.roomId;
}
export function stampSolid(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly x: number; readonly y: number; readonly semantic?: number }): void {
  if (!insideBounds(input)) return;
  const index = localIndex({ bounds: input.bounds, x: input.x, y: input.y });
  input.buffers.tiles[index] = TOPOLOGY.Uncarved;
  input.buffers.semantic[index] = input.semantic ?? FLOOR_SEMANTIC.Solid;
}

export function carveLine(input: {
  readonly buffers: FloorBuffers; readonly bounds: FloorBounds;
  readonly from: FloorPoint; readonly to: FloorPoint; readonly semantic: number;
}): void {
  let x = input.from.x;
  let y = input.from.y;
  while (x !== input.to.x) {
    carveAt({ buffers: input.buffers, bounds: input.bounds, point: { x, y }, semantic: input.semantic, regionId: 1 });
    x += Math.sign(input.to.x - x);
  }
  while (y !== input.to.y) {
    carveAt({ buffers: input.buffers, bounds: input.bounds, point: { x, y }, semantic: input.semantic, regionId: 1 });
    y += Math.sign(input.to.y - y);
  }
  carveAt({ buffers: input.buffers, bounds: input.bounds, point: { x, y }, semantic: input.semantic, regionId: 1 });
}

export function protectRect(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly rect: FloorRect }): void {
  forEachRect(input.rect, (x, y) => {
    if (insideBounds({ bounds: input.bounds, x, y })) input.buffers.protectedCells[localIndex({ bounds: input.bounds, x, y })] = 1;
  });
}
export function protectLine(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly from: FloorPoint; readonly to: FloorPoint }): void {
  let x = input.from.x;
  let y = input.from.y;
  while (x !== input.to.x || y !== input.to.y) {
    protectPoint(input.buffers, input.bounds, { x, y });
    if (x !== input.to.x) x += Math.sign(input.to.x - x);
    else y += Math.sign(input.to.y - y);
  }
  protectPoint(input.buffers, input.bounds, { x, y });
}
function protectPoint(buffers: FloorBuffers, bounds: FloorBounds, point: FloorPoint): void {
  if (insideBounds({ bounds, x: point.x, y: point.y })) buffers.protectedCells[localIndex({ bounds, ...point })] = 1;
}
export function stampFeature(input: {
  readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly x: number; readonly y: number;
  readonly tile: number; readonly face: number; readonly height: number; readonly semantic?: number;
}): void {
  if (!insideBounds(input)) return;
  const index = localIndex({ bounds: input.bounds, x: input.x, y: input.y });
  input.buffers.features[index] = input.tile;
  input.buffers.featureFaces[index] = input.face;
  input.buffers.featureHeight[index] = input.height;
  if (input.semantic !== undefined) input.buffers.semantic[index] = input.semantic;
}

export function materializeBuffers(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly voidTerrain: boolean }): void {
  forEachCell(input.bounds, (_x, _y, index) => materializeCell({ ...input, index }));
}
