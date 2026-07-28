import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { CHUNK_SIZE, TERRAIN, TILE, TOPOLOGY } from "../core/types.js";
import { generateChunk } from "./index.js";
import { buildRuntimeChunk, type GeneratedTerrain } from "./runtimeChunk.js";

const CELL_COUNT = CHUNK_SIZE * CHUNK_SIZE;

function source(overrides: Partial<GeneratedTerrain> = {}): GeneratedTerrain {
  return {
    tiles: new Uint8Array(CELL_COUNT).fill(TILE.Floor),
    height: new Float32Array(CELL_COUNT),
    zones: new Uint8Array(CELL_COUNT),
    ...overrides,
  };
}

describe("runtime chunk conversion", () => {
  it("keeps generated cells on a one-to-one 32x32 runtime grid", () => {
    const terrain = source({
      tiles: sequence(Uint8Array, (index) =>
        index % 3 === 0 ? TOPOLOGY.Uncarved : TILE.Floor),
      height: sequence(Float32Array, (index) => index % 17),
      zones: sequence(Uint8Array, (index) => index % 17),
    });
    const chunk = buildRuntimeChunk(4, -2, terrain);

    expect(chunk.tiles).toHaveLength(CELL_COUNT);
    for (let index = 0; index < CELL_COUNT; index++) {
      const voidCell = terrain.tiles[index] === TOPOLOGY.Uncarved;
      expect(chunk.tiles[index]).toBe(voidCell ? TILE.Void : TILE.Floor);
      expect(chunk.terrain[index]).toBe(voidCell ? TERRAIN.Void : TERRAIN.Floor);
      expect(chunk.height[index]).toBe(voidCell ? 0 : terrain.height[index]);
      expect(chunk.zones[index]).toBe(terrain.zones[index]);
    }
  });

  it("keeps complete deterministic chunks at the fixed chunk size", () => {
    const chunk = generateChunk({
      worldSeed: hashString("runtime-topology"),
      floor: 2,
      cx: 7,
      cy: -3,
    });
    expect(chunk.tiles).toHaveLength(CELL_COUNT);
    expect(chunk.height).toHaveLength(CELL_COUNT);
    expect(chunk.zones).toHaveLength(CELL_COUNT);
  });

  it("restores uncarved topology as finite floor when VOID is disabled", () => {
    const chunk = buildRuntimeChunk(0, 0, source({
      tiles: new Uint8Array(CELL_COUNT).fill(TOPOLOGY.Uncarved),
      height: new Float32Array(CELL_COUNT).fill(2),
      worldFeatures: { voidTerrain: false },
    }));

    expect(chunk.tiles[0]).toBe(TILE.Floor);
    expect(chunk.terrain[0]).toBe(TERRAIN.Floor);
    expect(chunk.height[0]).toBe(2);
  });

  it("rejects explicit VOID source cells when VOID is disabled", () => {
    expect(() => buildRuntimeChunk(0, 0, source({
      tiles: new Uint8Array(CELL_COUNT).fill(TILE.Void),
      worldFeatures: { voidTerrain: false },
    }))).toThrow(/VOID source leaked/);
  });

  it("preserves stairs, raised floor, and discrete feature anchors", () => {
    const tiles = new Uint8Array(CELL_COUNT).fill(TILE.Floor);
    const height = new Float32Array(CELL_COUNT).fill(2);
    const stairIndex = 9 * CHUNK_SIZE + 8;
    const doorIndex = 3 * CHUNK_SIZE + 4;
    tiles[stairIndex] = TILE.Stairs;
    tiles[doorIndex] = TILE.DoorSafeRoom;
    height[stairIndex] = 0.5;

    const chunk = buildRuntimeChunk(0, 0, source({ tiles, height }));

    expect(chunk.height[stairIndex]).toBe(0.5);
    expect(chunk.features[stairIndex]).toBe(TILE.Stairs);
    expect(chunk.tiles[doorIndex]).toBe(TILE.DoorSafeRoom);
    expect(chunk.features[doorIndex]).toBe(TILE.DoorSafeRoom);
    expect(chunk.height[doorIndex]).toBe(2);
  });
});

function sequence<T extends Uint8ArrayConstructor | Float32ArrayConstructor>(
  Constructor: T,
  valueAt: (index: number) => number,
): InstanceType<T> {
  return new Constructor(
    Array.from({ length: CELL_COUNT }, (_, index) => valueAt(index)),
  ) as InstanceType<T>;
}
