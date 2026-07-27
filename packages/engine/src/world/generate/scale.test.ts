import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { CHUNK_SIZE, TILE } from "../types.js";
import { generateChunk } from "./index.js";
import {
  GENERATION_CHUNK_SIZE,
  WORLD_GEOMETRY_SCALE,
  scaleGeneratedChunk,
} from "./scale.js";

describe("world geometry scale", () => {
  it("expands every generated cell into a coherent 2x2 block", () => {
    const source = {
      tiles: new Uint8Array(GENERATION_CHUNK_SIZE * GENERATION_CHUNK_SIZE)
        .map((_, index) => index % 3 === 0 ? 1 : 0),
      height: sequence(Float32Array),
      zones: sequence(Uint8Array),
    };
    const chunk = scaleGeneratedChunk(4, -2, source);

    expect(CHUNK_SIZE).toBe(GENERATION_CHUNK_SIZE * WORLD_GEOMETRY_SCALE);
    for (let sy = 0; sy < GENERATION_CHUNK_SIZE; sy++) {
      for (let sx = 0; sx < GENERATION_CHUNK_SIZE; sx++) {
        const sourceIndex = sy * GENERATION_CHUNK_SIZE + sx;
        for (let oy = 0; oy < WORLD_GEOMETRY_SCALE; oy++) {
          for (let ox = 0; ox < WORLD_GEOMETRY_SCALE; ox++) {
            const tx = sx * WORLD_GEOMETRY_SCALE + ox;
            const ty = sy * WORLD_GEOMETRY_SCALE + oy;
            const targetIndex = ty * CHUNK_SIZE + tx;
            const expectedTile = source.tiles[sourceIndex] === 1 ? TILE.Floor : source.tiles[sourceIndex];
            expect(chunk.tiles[targetIndex]).toBe(expectedTile);
            expect(chunk.terrain[targetIndex]).toBe(expectedTile === TILE.Void ? 1 : 0);
            expect(chunk.height[targetIndex]).toBe(source.height[sourceIndex]);
            expect(chunk.zones[targetIndex]).toBe(source.zones[sourceIndex]);
          }
        }
      }
    }
  });

  it("applies the transform to complete deterministic dungeon chunks", () => {
    const chunk = generateChunk(hashString("scaled-topology"), 2, 7, -3);
    for (let y = 0; y < CHUNK_SIZE; y += WORLD_GEOMETRY_SCALE) {
      for (let x = 0; x < CHUNK_SIZE; x += WORLD_GEOMETRY_SCALE) {
        const index = y * CHUNK_SIZE + x;
        const east = index + 1;
        const south = index + CHUNK_SIZE;
        const southeast = south + 1;
        expect(chunk.tiles[east]).toBe(chunk.tiles[index]);
        expect(chunk.tiles[south]).toBe(chunk.tiles[index]);
        expect(chunk.tiles[southeast]).toBe(chunk.tiles[index]);
        if (chunk.tiles[index] !== TILE.Stairs) {
          expect(chunk.height[east]).toBe(chunk.height[index]);
          expect(chunk.height[south]).toBe(chunk.height[index]);
          expect(chunk.height[southeast]).toBe(chunk.height[index]);
        }
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
