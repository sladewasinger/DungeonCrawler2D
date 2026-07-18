import { content } from "@dc2d/content";
import { describe, expect, it } from "vitest";
import { Rng } from "../core/rng";
import { AreaSystem, type AreaWorld } from "./system";

/**
 * Epic 5 unit tests: spread, decay, buoyancy (height-aware
 * propagation), area-vs-area meetings, sanctuary boundary.
 */

function flatWorld(opts: {
  heightFn?: (x: number, y: number) => number;
  sanctuary?: (x: number, y: number) => boolean;
}): AreaWorld {
  return {
    isWalkable: () => true,
    heightAt: (x, y) => opts.heightFn?.(x, y) ?? 0,
    groundAt: (x, y) => opts.heightFn?.(Math.floor(x), Math.floor(y)) ?? 0,
    isSanctuary: (x, y) => opts.sanctuary?.(x, y) ?? false,
  };
}

describe("area system", () => {
  it("spawns a blob and decays it away", () => {
    const areas = new AreaSystem(content, flatWorld({}));
    areas.spawn("area-steam", 10, 10, 1); // steam: 4 s, no spread
    expect(areas.size).toBeGreaterThanOrEqual(5);
    expect(areas.defAt(10, 10)).toBe("area-steam");
    const rng = new Rng(1);
    for (let i = 0; i < 5 / 0.05; i++) areas.tick(0.05, () => rng.next());
    expect(areas.size).toBe(0);
    // Dirty buffer saw both the placements and the removals.
    const dirty = areas.drainDirty();
    expect(dirty.some((d) => d.defId === null)).toBe(true);
  });

  it("fire spreads onto flammable areas (oil) but not bare floor", () => {
    const areas = new AreaSystem(content, flatWorld({}));
    // A line of oil leading away from the fire.
    for (let x = 11; x <= 14; x++) areas.place("area-oil", x, 10, 0);
    areas.place("area-fire", 10, 10, 0);
    const rng = new Rng(7);
    for (let i = 0; i < 200; i++) areas.tick(0.05, () => rng.next());
    // Fire consumed the oil line (fire replaces oil on meeting)…
    let fires = 0;
    for (let x = 10; x <= 14; x++) if (areas.defAt(x, 10) === "area-fire") fires++;
    expect(fires).toBeGreaterThanOrEqual(2);
    // …but never spread to bare tiles off the fuel line.
    expect(areas.defAt(10, 12)).toBeNull();
    expect(areas.defAt(8, 10)).toBeNull();
  });

  it("fire meeting wet becomes steam", () => {
    const areas = new AreaSystem(content, flatWorld({}));
    areas.place("area-wet", 5, 5, 0);
    areas.place("area-fire", 5, 5, 0);
    expect(areas.defAt(5, 5)).toBe("area-steam");
  });

  it("heavy gas sinks: poison never spreads uphill", () => {
    // A slope rising to the east: x is the height.
    const areas = new AreaSystem(content, flatWorld({ heightFn: (x) => x * 2 }));
    areas.place("area-poison", 10, 10, 0);
    const rng = new Rng(3);
    for (let i = 0; i < 240; i++) areas.tick(0.05, () => rng.next());
    // Anything east of the origin would be uphill — forbidden.
    expect(areas.defAt(11, 10)).toBeNull();
    expect(areas.defAt(12, 10)).toBeNull();
  });

  it("smoke rises: never spreads downhill", () => {
    const areas = new AreaSystem(content, flatWorld({ heightFn: (x) => x * 2 }));
    areas.place("area-smoke", 10, 10, 0);
    const rng = new Rng(3);
    for (let i = 0; i < 160; i++) areas.tick(0.05, () => rng.next());
    expect(areas.defAt(9, 10)).toBeNull();
    expect(areas.defAt(8, 10)).toBeNull();
  });

  it("hostile areas cannot enter sanctuary — fire dies at the threshold", () => {
    const sanctuary = (x: number) => x >= 12;
    const areas = new AreaSystem(content, flatWorld({ sanctuary }));
    areas.spawn("area-fire", 12, 10, 2); // blob centered on sanctuary ground
    expect(areas.defAt(12, 10)).toBeNull();
    expect(areas.defAt(13, 10)).toBeNull();
    expect(areas.defAt(10, 10)).toBe("area-fire"); // outside the line it burns
    // Non-hostile areas are allowed inside (steam drifting in is fine).
    areas.place("area-steam", 13, 10, 0);
    expect(areas.defAt(13, 10)).toBe("area-steam");
  });

  it("spread respects maxSteps generations", () => {
    const areas = new AreaSystem(content, flatWorld({}));
    // Wet spreads freely but only 2 generations.
    areas.place("area-wet", 50, 50, 0);
    const rng = new Rng(9);
    for (let i = 0; i < 400; i++) areas.tick(0.05, () => rng.next());
    for (const tile of areas.allTiles()) {
      const d = Math.abs(tile.x - 50) + Math.abs(tile.y - 50);
      expect(d).toBeLessThanOrEqual(2);
    }
  });
});
