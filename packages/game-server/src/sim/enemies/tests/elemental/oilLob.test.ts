import { describe, expect, it } from "vitest";
import { createOilFixture } from "./oilTestFixtures.js";
import { resolveOilLobImpact } from "../../elemental/oilLob.js";

describe("Pitchbloom oil lob", () => {
  it("uses the seeded server RNG for a repeatable ballistic launch", () => {
    const first = createOilFixture();
    const second = createOilFixture();

    expect(first.projectile.vel).toEqual(second.projectile.vel);
    expect(first.projectile.ownerId).toBe(first.enemy.id);
  });

  it("oils a direct target without placing a puddle", () => {
    const fixture = createOilFixture();
    resolveOilLobImpact({
      sim: fixture.sim,
      projectile: fixture.projectile,
      point: fixture.target.body,
      directHit: fixture.target,
      effectEvents: [],
    });

    expect(fixture.target.statuses).toEqual([
      expect.objectContaining({
        defId: "oiled",
        sourceId: fixture.enemy.id,
      }),
    ]);
    expect(fixture.sim.areas.size).toBe(0);
  });

  it("places one deterministic 2x2 oil footprint on a miss", () => {
    const fixture = createOilFixture();
    const point = {
      x: fixture.floor.x + 2.5,
      y: fixture.floor.y + 2.5,
    };
    resolveOilLobImpact({
      sim: fixture.sim,
      projectile: fixture.projectile,
      point,
      directHit: null,
      effectEvents: [],
    });

    expect(fixture.sim.areas.allTiles()).toEqual([
      { x: fixture.floor.x + 2, y: fixture.floor.y + 2, defId: "area-oil" },
      { x: fixture.floor.x + 3, y: fixture.floor.y + 2, defId: "area-oil" },
      { x: fixture.floor.x + 2, y: fixture.floor.y + 3, defId: "area-oil" },
      { x: fixture.floor.x + 3, y: fixture.floor.y + 3, defId: "area-oil" },
    ]);
    expect(fixture.sim.areas.sourceIdAt(fixture.floor.x + 2, fixture.floor.y + 2))
      .toBe(fixture.enemy.id);
  });
});
