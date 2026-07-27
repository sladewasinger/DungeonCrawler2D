import { describe, expect, it } from "vitest";
import { VIEW_ORIENTATIONS, type ViewOrientation } from "../view/viewOrientation.js";
import { TERRAIN4, planTerrain4, type Terrain4Kind, type Terrain4Source } from "./terrainPlanner.js";

const FLOOR = TERRAIN4.Floor;
const VOID = TERRAIN4.Void;

function source(
  terrain: ReadonlyMap<string, Terrain4Kind>,
  heights: ReadonlyMap<string, number>,
): Terrain4Source {
  return {
    terrainAt: (x, y) => terrain.get(`${x},${y}`) ?? VOID,
    heightAt: (x, y) => heights.get(`${x},${y}`) ?? 0,
  };
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

describe("planTerrain4", () => {
  it("emits a top quad for Floor and a flat cap for Void", () => {
    const plan = planTerrain4(
      source(new Map([[key(2, 3), FLOOR]]), new Map([[key(2, 3), 4]])),
      { bounds: { x: 2, y: 3, width: 2, height: 1 }, orientation: 0 },
    );

    expect(plan.batches.floors).toHaveLength(1);
    expect(plan.batches.floors[0]?.vertices).toEqual([
      { x: 2, y: 3, z: 4 },
      { x: 3, y: 3, z: 4 },
      { x: 3, y: 4, z: 4 },
      { x: 2, y: 4, z: 4 },
    ]);
    expect(plan.batches.voids).toHaveLength(1);
    expect(plan.batches.voids[0]?.vertices.every((vertex) => vertex.z === 0)).toBe(true);
    expect(plan.batches.southFaces).toEqual([]);
  });

  it("keeps authored features on a separate overlay batch", () => {
    const plan = planTerrain4({
      terrainAt: () => FLOOR,
      heightAt: () => 1,
      featureAt: (x, y) => x === 2 && y === 3 ? "stairs" : null,
    }, { bounds: { x: 2, y: 3, width: 1, height: 1 }, orientation: 0 });

    expect(plan.batches.floors).toEqual([]);
    expect(plan.batches.features).toHaveLength(1);
    expect(plan.batches.features[0]).toMatchObject({ kind: "feature", feature: "stairs", height: 1 });
  });

  it("emits a south face only across a descending Floor-to-Floor edge", () => {
    const terrain = new Map<string, Terrain4Kind>([
      [key(0, 0), FLOOR],
      [key(0, 1), FLOOR],
      [key(1, 0), FLOOR],
    ]);
    const plan = planTerrain4(
      source(terrain, new Map([[key(0, 0), 3], [key(0, 1), 1], [key(1, 0), 5]])),
      { bounds: { x: 0, y: 0, width: 2, height: 1 }, orientation: 0 },
    );

    expect(plan.batches.southFaces).toHaveLength(1);
    expect(plan.batches.southFaces[0]).toMatchObject({
      worldTile: { x: 0, y: 0 },
      topHeight: 3,
      bottomHeight: 1,
      vertices: [
        { x: 0, y: 1, z: 3 },
        { x: 1, y: 1, z: 3 },
        { x: 1, y: 1, z: 1 },
        { x: 0, y: 1, z: 1 },
      ],
    });
  });

  it("never turns a Floor-to-Void edge into a wall face", () => {
    const plan = planTerrain4(
      source(new Map([[key(0, 0), FLOOR]]), new Map([[key(0, 0), 3]])),
      { bounds: { x: 0, y: 0, width: 1, height: 1 }, orientation: 0 },
    );

    expect(plan.batches.southFaces).toEqual([]);
  });

  it("ignores sub-pixel height noise at a Floor-to-Floor seam", () => {
    const terrain = new Map<string, Terrain4Kind>([
      [key(0, 0), FLOOR], [key(0, 1), FLOOR],
    ]);
    const plan = planTerrain4(
      source(terrain, new Map([[key(0, 0), 1], [key(0, 1), 0.995]])),
      { bounds: { x: 0, y: 0, width: 1, height: 1 }, orientation: 0 },
    );
    expect(plan.batches.southFaces).toEqual([]);
  });

  it.each(VIEW_ORIENTATIONS)("uses the view-space south neighbor at orientation %i", (orientation) => {
    const { raised, south } = raisedAndViewSouth(orientation);
    const plan = planTerrain4(
      source(
        new Map([[key(raised.x, raised.y), FLOOR], [key(south.x, south.y), FLOOR]]),
        new Map([[key(raised.x, raised.y), 3], [key(south.x, south.y), 0]]),
      ),
      { bounds: { x: raised.x, y: raised.y, width: 1, height: 1 }, orientation },
    );

    expect(plan.batches.southFaces).toHaveLength(1);
    expect(plan.batches.southFaces[0]?.worldTile).toEqual(raised);
  });

  it("describes and reads through its seam apron without emitting apron tiles", () => {
    const plan = planTerrain4(
      source(
        new Map([[key(4, 4), FLOOR], [key(4, 5), FLOOR]]),
        new Map([[key(4, 4), 2], [key(4, 5), 0]]),
      ),
      { bounds: { x: 4, y: 4, width: 1, height: 1 }, orientation: 0, seamApron: 2 },
    );

    expect(plan.sampleBounds).toEqual({ x: 2, y: 2, width: 5, height: 5 });
    expect(plan.batches.floors).toHaveLength(1);
    expect(plan.batches.southFaces).toHaveLength(1);
  });
});

function raisedAndViewSouth(orientation: ViewOrientation): {
  raised: { x: number; y: number };
  south: { x: number; y: number };
} {
  switch (orientation) {
    case 0:
      return { raised: { x: 10, y: 10 }, south: { x: 10, y: 11 } };
    case 90:
      return { raised: { x: 10, y: 10 }, south: { x: 9, y: 10 } };
    case 180:
      return { raised: { x: 10, y: 10 }, south: { x: 10, y: 9 } };
    case 270:
      return { raised: { x: 10, y: 10 }, south: { x: 11, y: 10 } };
  }
}
