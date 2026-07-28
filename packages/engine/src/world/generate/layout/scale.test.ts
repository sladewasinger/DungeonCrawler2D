import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { CHUNK_SIZE, TERRAIN, TILE, TOPOLOGY } from "../../core/types.js";
import { generateChunk } from "../index.js";
import {
  GENERATION_CHUNK_SIZE,
  WORLD_GEOMETRY_SCALE,
  scaleGeneratedChunk,
} from "./scale.js";

function sourceCells(): Array<{ x: number; y: number }> {
  return Array.from({ length: GENERATION_CHUNK_SIZE ** 2 }, (_, index) => ({ x: index % GENERATION_CHUNK_SIZE, y: Math.floor(index / GENERATION_CHUNK_SIZE) }));
}

function scaledOffsets(): Array<{ x: number; y: number }> {
  return Array.from({ length: WORLD_GEOMETRY_SCALE ** 2 }, (_, index) => ({ x: index % WORLD_GEOMETRY_SCALE, y: Math.floor(index / WORLD_GEOMETRY_SCALE) }));
}

function assertScaledCell(source: { tiles: Uint8Array; height: Float32Array; zones: Uint8Array }, chunk: ReturnType<typeof scaleGeneratedChunk>, cell: { x: number; y: number }): void {
  const sourceIndex = cell.y * GENERATION_CHUNK_SIZE + cell.x;
  const sourceTile = source.tiles[sourceIndex] ?? TOPOLOGY.Uncarved;
  const sourceHeight = source.height[sourceIndex] ?? 0;
  const expectedTile = isVoidSource(sourceTile, sourceHeight) ? TILE.Void : sourceTile;
  const expectedTerrain = expectedTile === TILE.Void ? TERRAIN.Void : TERRAIN.Floor;
  const expectedHeight = expectedTile === TILE.Void ? 0 : source.height[sourceIndex];
  for (const offset of scaledOffsets()) {
    const index = (cell.y * WORLD_GEOMETRY_SCALE + offset.y) * CHUNK_SIZE + cell.x * WORLD_GEOMETRY_SCALE + offset.x;
    expect(chunk.tiles[index]).toBe(expectedTile);
    expect(chunk.terrain[index]).toBe(expectedTerrain);
    expect(chunk.height[index]).toBe(expectedHeight);
    expect(chunk.zones[index]).toBe(source.zones[sourceIndex]);
  }
}

function isVoidSource(tile: number, height: number): boolean {
  return tile === TOPOLOGY.Uncarved || tile === TILE.Void || (tile === TILE.Floor && height >= 2);
}

function assertGeneratedBlock(chunk: ReturnType<typeof generateChunk>, index: number): void {
  const neighbors = [index + 1, index + CHUNK_SIZE, index + CHUNK_SIZE + 1];
  for (const neighbor of neighbors) expect(chunk.tiles[neighbor]).toBe(chunk.tiles[index]);
  if (chunk.tiles[index] !== TILE.Stairs) for (const neighbor of neighbors) expect(chunk.height[neighbor]).toBe(chunk.height[index]);
}

describe("world geometry scale", () => {
  it("expands every generated cell into a coherent 2x2 block", () => {
    const source = {
      tiles: new Uint8Array(GENERATION_CHUNK_SIZE * GENERATION_CHUNK_SIZE)
        .map((_, index) => index % 3 === 0 ? TOPOLOGY.Uncarved : TILE.Floor),
      height: sequence(Float32Array),
      zones: sequence(Uint8Array),
    };
    const chunk = scaleGeneratedChunk(4, -2, source);

    expect(CHUNK_SIZE).toBe(GENERATION_CHUNK_SIZE * WORLD_GEOMETRY_SCALE);
    for (const cell of sourceCells()) assertScaledCell(source, chunk, cell);
  });

  it("applies the transform to complete deterministic dungeon chunks", () => {
    const chunk = generateChunk({ worldSeed: hashString("scaled-topology"), floor: 2, cx: 7, cy: -3 });
    for (let y = 0; y < CHUNK_SIZE; y += WORLD_GEOMETRY_SCALE) {
      for (let x = 0; x < CHUNK_SIZE; x += WORLD_GEOMETRY_SCALE) {
        const index = y * CHUNK_SIZE + x;
        assertGeneratedBlock(chunk, index);
      }
    }
  });

  it("stretches stair slopes instead of creating flat invalid stair blocks", () => {
    const length = GENERATION_CHUNK_SIZE * GENERATION_CHUNK_SIZE;
    const tiles = new Uint8Array(length).fill(TILE.Floor);
    const height = new Float32Array(length);
    const x = 8;
    const y = 9;
    tiles[y * GENERATION_CHUNK_SIZE + x] = TILE.Stairs;
    height[y * GENERATION_CHUNK_SIZE + x] = 0.5;
    height[y * GENERATION_CHUNK_SIZE + x + 1] = 1;
    const chunk = scaleGeneratedChunk(0, 0, {
      tiles,
      height,
      zones: new Uint8Array(length),
    });
    const left = (y * 2) * CHUNK_SIZE + x * 2;
    expect(chunk.height[left]).toBe(0.375);
    expect(chunk.height[left + 1]).toBe(0.625);
  });

  it("turns z2 Floor source cells into heightless VOID cells", () => {
    const length = GENERATION_CHUNK_SIZE * GENERATION_CHUNK_SIZE;
    const height = new Float32Array(length).fill(2);
    const chunk = scaleGeneratedChunk(0, 0, {
      tiles: new Uint8Array(length).fill(TILE.Floor),
      height,
      zones: new Uint8Array(length),
    });

    expect(chunk.tiles[0]).toBe(TILE.Void);
    expect(chunk.terrain[0]).toBe(TERRAIN.Void);
    expect(chunk.height[0]).toBe(0);
  });

  it("preserves explicit features on raised source cells", () => {
    const length = GENERATION_CHUNK_SIZE * GENERATION_CHUNK_SIZE;
    const tiles = new Uint8Array(length).fill(TILE.Floor);
    const height = new Float32Array(length).fill(2);
    const featureIndex = 3 * GENERATION_CHUNK_SIZE + 4;
    tiles[featureIndex] = TILE.DoorSafeRoom;
    const chunk = scaleGeneratedChunk(0, 0, { tiles, height, zones: new Uint8Array(length) });
    const anchor = (3 * WORLD_GEOMETRY_SCALE + 1) * CHUNK_SIZE + 4 * WORLD_GEOMETRY_SCALE;

    expect(chunk.tiles[anchor]).toBe(TILE.DoorSafeRoom);
    expect(chunk.features[anchor]).toBe(TILE.DoorSafeRoom);
    expect(chunk.terrain[anchor]).toBe(TERRAIN.Floor);
    expect(chunk.height[anchor]).toBe(2);
    expect(chunk.tiles[anchor + 1]).toBe(TILE.Floor);
    expect(chunk.terrain[anchor + 1]).toBe(TERRAIN.Void);
    expect(chunk.height[anchor + 1]).toBe(0);
  });
});

function sequence<T extends Uint8ArrayConstructor | Float32ArrayConstructor>(
  Constructor: T,
): InstanceType<T> {
  return new Constructor(
    Array.from(
      { length: GENERATION_CHUNK_SIZE * GENERATION_CHUNK_SIZE },
      (_, index) => index % 17,
    ),
  ) as InstanceType<T>;
}
