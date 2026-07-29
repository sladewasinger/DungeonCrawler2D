import { describe, expect, it } from "vitest";
import { TILE, TOPOLOGY } from "../../core/types.js";
import {
  classifyFiniteWallStructures,
  markBedrockStructures,
} from "./bedrock.js";

const SIZE = 7;

describe("structural bedrock classification", () => {
  it("promotes a connected z2 cap without consuming its z1 border", () => {
    const tiles = new Uint8Array(SIZE * SIZE).fill(TILE.Floor);
    const height = new Float32Array(SIZE * SIZE).fill(1);
    stampWallRect(tiles, { x0: 1, y0: 1, x1: 3, y1: 3 });
    height[1 * SIZE + 2] = 2;
    height[2 * SIZE + 2] = 2;
    height[2 * SIZE + 1] = 1.995;

    markBedrockStructures(tiles, height, SIZE);

    expect(tiles[1 * SIZE + 2]).toBe(TILE.Bedrock);
    expect(tiles[2 * SIZE + 2]).toBe(TILE.Bedrock);
    expect(tiles[2 * SIZE + 1]).toBe(TOPOLOGY.Uncarved);
    expect(tiles[3 * SIZE + 2]).toBe(TOPOLOGY.Uncarved);
  });

  it("keeps a disconnected two-tile island jumpable", () => {
    const tiles = new Uint8Array(SIZE * SIZE).fill(TILE.Floor);
    const height = new Float32Array(SIZE * SIZE).fill(2);
    stampWallRect(tiles, { x0: 0, y0: 0, x1: 2, y1: 2 });
    tiles[2 * SIZE + 5] = TOPOLOGY.Uncarved;
    tiles[3 * SIZE + 5] = TOPOLOGY.Uncarved;

    markBedrockStructures(tiles, height, SIZE);

    expect(tiles[2 * SIZE + 5]).toBe(TOPOLOGY.Uncarved);
    expect(tiles[3 * SIZE + 5]).toBe(TOPOLOGY.Uncarved);
  });

  it("never marks a structural core below absolute z2", () => {
    const tiles = new Uint8Array(SIZE * SIZE).fill(TOPOLOGY.Uncarved);
    const height = new Float32Array(SIZE * SIZE).fill(1);

    markBedrockStructures(tiles, height, SIZE);

    expect(Array.from(tiles)).not.toContain(TILE.Bedrock);
  });

  it("restores every nonstructural finite wall cap as jumpable floor", () => {
    const tiles = new Uint8Array(SIZE * SIZE).fill(TILE.Floor);
    const height = new Float32Array(SIZE * SIZE).fill(2);
    tiles[2 * SIZE + 5] = TOPOLOGY.Uncarved;
    tiles[3 * SIZE + 5] = TOPOLOGY.Uncarved;

    classifyFiniteWallStructures(tiles, height, SIZE);

    expect(tiles[2 * SIZE + 5]).toBe(TILE.Floor);
    expect(tiles[3 * SIZE + 5]).toBe(TILE.Floor);
    expect(Array.from(tiles)).not.toContain(TOPOLOGY.Uncarved);
  });
});

interface WallRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

function stampWallRect(tiles: Uint8Array, rect: WallRect): void {
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) {
      tiles[y * SIZE + x] = TOPOLOGY.Uncarved;
    }
  }
}
