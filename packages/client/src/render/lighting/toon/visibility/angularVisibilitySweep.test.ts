import { describe, expect, it } from "vitest";
import { sweepAngularVisibility } from "./angularVisibilitySweep.js";

describe("toon angular visibility sweep", () => {
  it("visits every cell once when no terrain casts a shadow", () => {
    const visited = new Set<string>();
    const result = sweepAngularVisibility({
      bounds: { x: -4, y: -3, width: 9, height: 7 },
      origin: { x: 0, y: 0 },
      isOpaque: () => false,
      visit: (cell) => visited.add(`${cell.x},${cell.y}`),
    });

    expect(visited.size).toBe(63);
    expect(result.evaluatedCells).toBe(63);
    expect(result.occluderChecks).toBe(63);
  });

  it("reveals an occluder while hiding cells inside its angular shadow", () => {
    const visited = new Set<string>();
    sweepAngularVisibility({
      bounds: { x: -1, y: -1, width: 5, height: 3 },
      origin: { x: 0, y: 0 },
      isOpaque: ({ x, y }) => x === 1 && y === 0,
      visit: (cell) => visited.add(`${cell.x},${cell.y}`),
    });

    expect(visited.has("1,0")).toBe(true);
    expect(visited.has("2,0")).toBe(false);
    expect(visited.has("3,0")).toBe(false);
  });

  it("does not reveal diagonally through the corner of an opaque cell", () => {
    const visited = new Set<string>();
    sweepAngularVisibility({
      bounds: { x: 0, y: 0, width: 3, height: 3 },
      origin: { x: 0, y: 0 },
      isOpaque: ({ x, y }) => x === 1 && y === 0,
      visit: (cell) => visited.add(`${cell.x},${cell.y}`),
    });

    expect(visited.has("1,1")).toBe(false);
  });
});
