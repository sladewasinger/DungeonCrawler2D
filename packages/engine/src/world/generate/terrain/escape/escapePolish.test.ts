import { describe, expect, it } from "vitest";
import { TILE, TOPOLOGY } from "../../../core/types.js";
import { polishTerrainEscapes } from "./escapePolish.js";

const SIZE = 7;

function indexAt(x: number, y: number): number {
  return y * SIZE + x;
}

function trappedBasin() {
  const cells = SIZE * SIZE;
  const tiles = new Uint8Array(cells).fill(TILE.Floor);
  const height = new Float32Array(cells);
  const corridorCarved = new Uint8Array(cells);
  const featureTiles = new Uint8Array(cells);
  for (let x = 0; x < SIZE; x++) corridorCarved[indexAt(x, 0)] = 1;
  for (let y = 2; y <= 4; y++) {
    for (let x = 2; x <= 4; x++) stampRingCell({ tiles, height, x, y });
  }
  return { tiles, height, corridorCarved, featureTiles, size: SIZE };
}

function stampRingCell(input: {
  tiles: Uint8Array;
  height: Float32Array;
  x: number;
  y: number;
}): void {
  if (input.x === 3 && input.y === 3) return;
  const index = indexAt(input.x, input.y);
  input.tiles[index] = TOPOLOGY.Uncarved;
  input.height[index] = 2;
}

describe("terrain escape polish", () => {
  it("cuts one jumpable notch out of an otherwise one-way basin", () => {
    const terrain = trappedBasin();

    polishTerrainEscapes(terrain);

    const ring = [
      indexAt(2, 2), indexAt(3, 2), indexAt(4, 2),
      indexAt(2, 3), indexAt(4, 3),
      indexAt(2, 4), indexAt(3, 4), indexAt(4, 4),
    ];
    const notch = ring.filter((index) => terrain.height[index] === 1);
    expect(notch).toHaveLength(1);
    const notchIndex = notch[0];
    expect(notchIndex).toBeDefined();
    if (notchIndex === undefined) return;
    expect(terrain.tiles[notchIndex]).toBe(TILE.Floor);
    expect(terrain.height[indexAt(3, 3)]).toBe(0);
  });

  it("does not alter a basin that already has a one-tile escape", () => {
    const terrain = trappedBasin();
    terrain.height[indexAt(3, 2)] = 1;
    const before = terrain.height.slice();

    polishTerrainEscapes(terrain);

    expect(terrain.height).toEqual(before);
  });

  it("cuts the shortest z2 floor bridge through final Bedrock topology", () => {
    const terrain = trappedBasin();
    terrain.height.fill(2);
    terrain.height[indexAt(3, 3)] = 1;
    const ring = [
      indexAt(2, 2), indexAt(3, 2), indexAt(4, 2),
      indexAt(2, 3), indexAt(4, 3),
      indexAt(2, 4), indexAt(3, 4), indexAt(4, 4),
    ];
    for (const index of ring) {
      terrain.tiles[index] = TILE.Bedrock;
      terrain.height[index] = 2;
    }

    polishTerrainEscapes(terrain);

    const bridge = ring.filter((index) => terrain.tiles[index] === TILE.Floor);
    expect(bridge).toHaveLength(1);
    expect(terrain.height[bridge[0] ?? -1]).toBe(2);
    expect(ring.filter((index) =>
      terrain.tiles[index] === TILE.Bedrock
    )).toHaveLength(7);
  });
});
