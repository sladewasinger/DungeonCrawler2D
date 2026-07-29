import { describe, expect, it } from "vitest";
import { VIEW_ORIENTATIONS, type ViewOrientation } from "../../../view/orientation/viewOrientation.js";
import { viewTileToWorld, worldTileToView, type Point } from "../../../view/transform/viewTransform.js";
import {
  planTerrain,
  TERRAIN_KINDS,
  type TerrainAOQuad,
  type TerrainKind,
  type TerrainSource,
} from "../terrainPlanner.js";

const FLOOR = TERRAIN_KINDS.Floor;
const VOID = TERRAIN_KINDS.Void;

describe("wall ambient occlusion", () => {
  it.each(VIEW_ORIENTATIONS)("marks both concave wall corners at orientation %i", (orientation) => {
    const fixture = wallFixture(orientation);
    for (const side of [-1, 1] as const) {
      fixture.setTile(offset(fixture.view, side, 0), FLOOR, 2);
      fixture.setTile(offset(fixture.view, side, 1), FLOOR, 2);
    }
    const wallAO = planWallAO(fixture);

    expect(wallAO).toHaveLength(2);
    expect(wallAO.map(({ mask }) => [mask.west, mask.east])).toEqual([
      [true, false],
      [false, true],
    ]);
    expect(wallAO.every(({ vertices }) => vertices.map(({ z }) => z).join() === "2,2,0,0")).toBe(true);
  });

  it.each(VIEW_ORIENTATIONS)("does not shade isolated outer corners at orientation %i", (orientation) => {
    const fixture = wallFixture(orientation);

    expect(planWallAO(fixture)).toEqual([]);
  });

  it.each(VIEW_ORIENTATIONS)("does not shade a straight wall seam at orientation %i", (orientation) => {
    const fixture = wallFixture(orientation);
    fixture.setTile(offset(fixture.view, 1, 0), FLOOR, 2);
    fixture.setTile(offset(fixture.view, 1, 1), FLOOR, 0);

    expect(planWallAO(fixture)).toEqual([]);
  });

  it("does not shade a diagonal-only outer contact", () => {
    const fixture = wallFixture(0);
    fixture.setTile(offset(fixture.view, 1, 1), FLOOR, 2);

    expect(planWallAO(fixture)).toEqual([]);
  });

  it("shades only the shared vertical extent of an inside corner", () => {
    const fixture = wallFixture(0, 3);
    fixture.setTile(offset(fixture.view, 1, 0), FLOOR, 2);
    fixture.setTile(offset(fixture.view, 1, 1), FLOOR, 1);
    const eastAO = planWallAO(fixture).filter(({ mask }) => mask.east);

    expect(eastAO).toHaveLength(1);
    expect(eastAO.map(({ vertices }) => vertices.map(({ z }) => z))).toEqual([
      [1, 1, 0, 0],
    ]);
  });

  it("does not require the wrapping tile to emit another screen-facing wall", () => {
    const fixture = wallFixture(0);
    fixture.setTile(offset(fixture.view, 1, 0), FLOOR, 2);
    fixture.setTile(offset(fixture.view, 1, 1), FLOOR, 2);
    fixture.setTile(offset(fixture.view, 1, 2), FLOOR, 2);

    expect(planWallAO(fixture).some(({ mask }) => mask.east)).toBe(true);
  });

  it("shades an inside corner on a floating wall above VOID", () => {
    const fixture = wallFixture(0);
    fixture.setTile(offset(fixture.view, 0, 1), VOID, 0);
    fixture.setTile(offset(fixture.view, 1, 0), FLOOR, 2);
    fixture.setTile(offset(fixture.view, 1, 1), FLOOR, 2);
    const eastAO = planWallAO(fixture).filter(({ mask }) => mask.east);

    expect(eastAO).toHaveLength(1);
    expect(eastAO[0]?.vertices.map(({ z }) => z)).toEqual([2, 2, 1, 1]);
  });
});

interface WallFixture {
  readonly current: Point;
  readonly view: Point;
  readonly orientation: ViewOrientation;
  readonly source: TerrainSource;
  setTile(viewTile: Point, kind: TerrainKind, height: number): void;
}

function wallFixture(orientation: ViewOrientation, topHeight = 2): WallFixture {
  const current = { x: 12, y: 12 };
  const view = worldTileToView(current, orientation);
  const terrain = new Map<string, TerrainKind>();
  const heights = new Map<string, number>();
  const setTile = (viewTile: Point, kind: TerrainKind, height: number): void => {
    const worldTile = viewTileToWorld(viewTile, orientation);
    terrain.set(key(worldTile), kind);
    heights.set(key(worldTile), height);
  };
  setTile(view, FLOOR, topHeight);
  setTile(offset(view, 0, 1), FLOOR, 0);
  return {
    current, view, orientation, setTile,
    source: {
      voidTerrain: true,
      terrainAt: (x, y) => terrain.get(key({ x, y })) ?? VOID,
      heightAt: (x, y) => heights.get(key({ x, y })) ?? 0,
    },
  };
}

function planWallAO(fixture: WallFixture): readonly TerrainAOQuad[] {
  const plan = planTerrain(fixture.source, {
    bounds: { ...fixture.current, width: 1, height: 1 },
    orientation: fixture.orientation,
  });
  return plan.batches.ao.filter(({ surface }) => surface === "wall");
}

function offset(tile: Point, x: number, y: number): Point {
  return { x: tile.x + x, y: tile.y + y };
}

function key(tile: Point): string {
  return `${tile.x},${tile.y}`;
}
