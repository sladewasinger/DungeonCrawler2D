// Spread, decay, buoyancy (height-aware propagation), area-vs-area meetings, sanctuary boundary.
import { describe, expect, it } from "vitest";
import { buildContentRegistry } from "../effects/types.js";
import { Rng } from "../core/rng.js";
import { AreaSystem, type AreaWorld } from "./system.js";

// Mirrors packages/content/src/data/areas.json's values for the areas these
// tests exercise; engine code may not import @dc2d/content (import boundary).
function minimalStatus(id: string) {
  return {
    id,
    name: id,
    kind: "debuff" as const,
    tags: [] as string[],
    duration: 5,
    stacking: "refresh" as const,
  };
}

const content = buildContentRegistry({
  statuses: ["on-fire", "wet", "slowed", "poisoned"].map(minimalStatus),
  rules: [],
  areas: [
    {
      id: "area-fire",
      tags: ["fire", "hostile"],
      buoyancy: 0,
      duration: 8,
      onEnterStatus: "on-fire",
      spread: { chance: 0.5, ontoAreaTag: "flammable", maxSteps: 6 },
      sprite: "fire",
    },
    {
      id: "area-wet",
      tags: ["wet", "liquid"],
      buoyancy: -1,
      duration: 25,
      onEnterStatus: "wet",
      spread: { chance: 0.15, maxSteps: 2 },
      sprite: "wet",
    },
    {
      id: "area-oil",
      tags: ["oil", "flammable", "liquid"],
      buoyancy: -1,
      duration: 40,
      onEnterStatus: "slowed",
      spread: { chance: 0.1, maxSteps: 2 },
      sprite: "oil",
    },
    {
      id: "area-poison",
      tags: ["poison", "gas", "hostile"],
      buoyancy: -1,
      duration: 12,
      onEnterStatus: "poisoned",
      spread: { chance: 0.3, maxSteps: 4 },
      sprite: "poison",
    },
    { id: "area-smoke", tags: ["smoke", "gas"], buoyancy: 1, duration: 8, spread: { chance: 0.3, maxSteps: 3 }, sprite: "smoke" },
    { id: "area-steam", tags: ["steam", "gas"], buoyancy: 1, duration: 4, sprite: "steam" },
  ],
  items: [],
  enemies: [],
  recipes: [],
});

function flatWorld(opts: {
  heightFn?: (x: number, y: number) => number;
  sanctuary?: (x: number, y: number) => boolean;
}): AreaWorld {
  return {
    isWalkable: () => true,
    heightAt: (x, y) => opts.heightFn?.(x, y) ?? 0,
    groundAt: (x, y) => opts.heightFn?.(Math.floor(x), Math.floor(y)) ?? 0,
    isSanctuary: (x, y) => opts.sanctuary?.(x, y) ?? false,
    stairHeightAt: () => null,
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
