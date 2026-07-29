import { describe, expect, it } from "vitest";
import type { AreaTileView } from "../areaEffectPool.js";
import {
  buildFireFieldComponents,
  fireFieldTopologyHash,
} from "./fireFieldTopology.js";

function fire(input: {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly groundHeight?: number;
}): AreaTileView {
  const { id, x, y, groundHeight = 0 } = input;
  return {
    id,
    effectId: "area-fire",
    x,
    y,
    groundHeight,
    screenX: 0,
    screenY: 0,
    sprite: "fire",
    neighborMask: 0,
  };
}

describe("connected fire topology", () => {
  it("treats edge-sharing fire cells as one field and diagonals as separate", () => {
    const tiles = [
      fire({ id: "center", x: 0, y: 0 }),
      fire({ id: "east", x: 1, y: 0 }),
      fire({ id: "south", x: 0, y: 1 }),
      fire({ id: "diagonal", x: 4, y: 4 }),
    ];
    const components = buildFireFieldComponents(tiles, 0);
    expect(components.map(({ tiles: cells }) => cells.length)).toEqual([3, 1]);
  });

  it("uses an order-independent topology hash for clean-frame reuse", () => {
    const first = [
      fire({ id: "a", x: 0, y: 0 }),
      fire({ id: "b", x: 1, y: 0 }),
    ];
    expect(fireFieldTopologyHash(first, 0))
      .toBe(fireFieldTopologyHash([...first].reverse(), 0));
    expect(fireFieldTopologyHash(first, 270))
      .not.toBe(fireFieldTopologyHash(first, 0));
  });

  it("splits edge-sharing fire at a terrain-height change", () => {
    const components = buildFireFieldComponents([
      fire({ id: "low", x: 0, y: 0 }),
      fire({ id: "raised", x: 1, y: 0, groundHeight: 1 }),
    ], 0);
    expect(components.map(({ tiles }) => tiles)).toEqual([
      [expect.objectContaining({ id: "low" })],
      [expect.objectContaining({ id: "raised" })],
    ]);
  });
});
