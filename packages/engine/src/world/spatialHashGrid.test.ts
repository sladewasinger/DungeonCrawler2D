import { describe, expect, it } from "vitest";
import { SpatialHashGrid } from "./spatialHashGrid.js";

interface Pt { readonly id: string; readonly x: number; readonly y: number }

describe("SpatialHashGrid", () => {
  it("indexes positive & negative coordinates and returns exact radius matches", () => {
    const grid = new SpatialHashGrid<Pt>(16);
    grid.insertAll([
      { id: "origin", x: 0, y: 0 },
      { id: "edge", x: 5, y: 0 },
      { id: "neg-in", x: -3.2, y: -3.2 },
      { id: "far", x: -48, y: 64 },
    ]);
    expect(grid.size).toBe(4);
    const hits = grid.queryRadius({ x: 0, y: 0, radius: 5 }).map((p) => p.id).sort();
    expect(hits).toEqual(["edge", "neg-in", "origin"]);
  });

  it("queries AABB windows accurately across chunk boundaries and reuses cleared buckets", () => {
    const grid = new SpatialHashGrid<Pt>(8);
    grid.insertAll([
      { id: "a", x: 7.9, y: 8.1 },
      { id: "b", x: -8.1, y: -0.5 },
      { id: "c", x: 25, y: 25 },
    ]);
    const box = grid.queryAabb({ minX: -9, minY: -1, maxX: 8, maxY: 9 }).map((p) => p.id).sort();
    expect(box).toEqual(["a", "b"]);
    grid.clear();
    expect(grid.size).toBe(0);
    expect(grid.queryRadius({ x: 0, y: 0, radius: 50 })).toEqual([]);
    grid.insert({ id: "d", x: 7.9, y: 8.1 });
    expect(grid.queryRadius({ x: 8, y: 8, radius: 1 }).map((p) => p.id)).toEqual(["d"]);
  });
});
