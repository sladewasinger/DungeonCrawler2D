import { describe, expect, it } from "vitest";
import type { AreaTileView } from "../areaEffectPool.js";
import type { FireFieldComponent } from "./fireFieldTopology.js";
import {
  createFireEmissionSnapshot,
  sampleFireEmission,
  type FireEmissionSnapshot,
  FireUnionEmissionSource,
} from "./fireUnionEmissionSource.js";

function field(points: readonly [number, number][]): FireFieldComponent {
  const tiles: AreaTileView[] = points.map(([x, y], index) => ({
    id: `fire-${index}`,
    effectId: "area-fire",
    x,
    y,
    groundHeight: 0,
    screenX: x,
    screenY: y,
    sprite: "fire",
    neighborMask: 0,
  }));
  return { signature: "fire-field", tiles };
}

function emissions(
  component: FireFieldComponent,
  count: number,
): ReadonlyArray<{ readonly x: number; readonly y: number }> {
  const snapshot = createFireEmissionSnapshot(component);
  return Array.from({ length: count }, (_, index) =>
    sampleFireEmission({ snapshot, index, phase: 0 })
  );
}

function contains(snapshot: FireEmissionSnapshot, point: {
  readonly x: number;
  readonly y: number;
}): boolean {
  return snapshot.regions.some((region) =>
    point.x >= region.minimumX && point.x <= region.maximumX &&
    point.y >= region.minimumY && point.y <= region.maximumY
  );
}

function cellFor(point: { readonly x: number; readonly y: number }): string {
  return `${Math.floor(point.x + 0.5)},${Math.floor(point.y + 0.5)}`;
}

describe("FireUnionEmissionSource", () => {
  it("samples all cross cells fractionally across their shared seams", () => {
    const component = field([[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]);
    const snapshot = createFireEmissionSnapshot(component);
    const points = emissions(component, 240);

    expect(points.every((point) => contains(snapshot, point))).toBe(true);
    expect(new Set(points.map(cellFor))).toEqual(new Set([
      "0,0", "-1,0", "1,0", "0,-1", "0,1",
    ]));
    expect(points.some(({ x, y }) => Math.abs(x - 0.5) < 0.1 && Math.abs(y) < 0.45))
      .toBe(true);
    expect(points.some(({ x, y }) => Math.abs(x + 0.5) < 0.1 && Math.abs(y) < 0.45))
      .toBe(true);
    expect(points.some(({ x, y }) => Math.abs(x - Math.round(x)) > 0.25 || Math.abs(y - Math.round(y)) > 0.25))
      .toBe(true);
  });

  it("never fills the missing concave cell of an L-shaped field", () => {
    const component = field([[0, 0], [1, 0], [0, 1]]);
    const snapshot = createFireEmissionSnapshot(component);
    const points = emissions(component, 180);

    expect(points.every((point) => contains(snapshot, point))).toBe(true);
    expect(points.some(({ x, y }) => x > 0.5 && y > 0.5)).toBe(false);
  });

  it("keeps a one-cell field centered", () => {
    expect(emissions(field([[4, 7]]), 2)).toEqual([
      { x: 4, y: 7 },
      { x: 4, y: 7 },
    ]);
  });

  it("updates one source without restarting its emission sequence", () => {
    const fieldId = "persistent-field";
    const source = new FireUnionEmissionSource();
    source.sync(field([[0, 0], [1, 0]]), fieldId);
    source.getRandomPoint({ x: 0, y: 0 });
    source.sync(field([[0, 0], [1, 0], [2, 0]]), fieldId);
    const continued = { x: 0, y: 0 };
    source.getRandomPoint(continued);

    const restarted = new FireUnionEmissionSource();
    restarted.sync(field([[0, 0], [1, 0], [2, 0]]), fieldId);
    const fresh = { x: 0, y: 0 };
    restarted.getRandomPoint(fresh);
    expect(continued).not.toEqual(fresh);
  });
});
