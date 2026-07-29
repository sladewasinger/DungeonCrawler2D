import { describe, expect, it } from "vitest";
import { TILE, TOPOLOGY } from "../../core/types.js";
import { markBedrockStructures } from "./bedrock.js";

const SIZE = 7;

describe("structural bedrock classification", () => {
  it("promotes an entire connected wall shape when it contains a core", () => {
    const tiles = new Uint8Array(SIZE * SIZE).fill(TILE.Floor);
    stampWallRect(tiles, { x0: 0, y0: 0, x1: 2, y1: 2 });

    markBedrockStructures(tiles, SIZE);

    for (let y = 0; y <= 2; y++) {
      for (let x = 0; x <= 2; x++) {
        expect(tiles[y * SIZE + x]).toBe(TILE.Bedrock);
      }
    }
  });

  it("keeps a disconnected two-tile island jumpable", () => {
    const tiles = new Uint8Array(SIZE * SIZE).fill(TILE.Floor);
    stampWallRect(tiles, { x0: 0, y0: 0, x1: 2, y1: 2 });
    tiles[2 * SIZE + 5] = TOPOLOGY.Uncarved;
    tiles[3 * SIZE + 5] = TOPOLOGY.Uncarved;

    markBedrockStructures(tiles, SIZE);

    expect(tiles[2 * SIZE + 5]).toBe(TOPOLOGY.Uncarved);
    expect(tiles[3 * SIZE + 5]).toBe(TOPOLOGY.Uncarved);
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
