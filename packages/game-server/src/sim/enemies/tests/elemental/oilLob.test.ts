import { describe, expect, it } from "vitest";
import { blockSurfaceCell } from "./elementalBoundaryTestSupport.js";
import { createOilFixture } from "./oilTestFixtures.js";
import { resolveProjectileImpact } from "../../../projectiles/impact.js";
import { stepProjectiles } from "../../../projectiles/index.js";

describe("Pitchbloom oil lob", () => {
  it("uses the seeded server RNG for a repeatable ballistic launch", () => {
    const first = createOilFixture();
    const second = createOilFixture();

    expect(first.projectile.vel).toEqual(second.projectile.vel);
    expect(first.projectile.ownerId).toBe(first.enemy.id);
  });

  it("oils an authoritative direct hit without placing a puddle", () => {
    const fixture = createOilFixture();
    blockSurfaceCell(fixture.sim, {
      cell: { x: fixture.floor.x + 1, y: fixture.floor.y + 1 },
      boundary: "walkable",
    });
    fixture.sim.enemies.delete(fixture.enemy.id);
    fixture.projectile.body.x = fixture.target.body.x;
    fixture.projectile.body.y = fixture.target.body.y;
    fixture.projectile.body.z = fixture.target.body.z;
    delete fixture.projectile.vel;

    stepProjectiles(fixture.sim, []);

    expect(fixture.target.statuses).toEqual([
      expect.objectContaining({
        defId: "oiled",
        sourceId: fixture.enemy.id,
        remaining: fixture.sim.content.statuses.get("oiled")?.duration,
      }),
    ]);
    expect(fixture.sim.areas.size).toBe(0);
    expect(fixture.sim.projectiles.size).toBe(0);
  });

  it("places one deterministic 2x2 oil footprint on a miss", () => {
    const fixture = createOilFixture();
    const point = {
      x: fixture.floor.x + 2.5,
      y: fixture.floor.y + 2.5,
    };
    resolveProjectileImpact({
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

  it("places its 2x2 footprint when its owner dies in flight", () => {
    const fixture = createOilFixture();
    const point = {
      x: fixture.floor.x + 2.5,
      y: fixture.floor.y + 2.5,
    };
    fixture.sim.enemies.delete(fixture.enemy.id);
    fixture.projectile.body.x = point.x;
    fixture.projectile.body.y = point.y;
    fixture.projectile.body.z = fixture.sim.world.groundAt(point.x, point.y);
    delete fixture.projectile.vel;

    stepProjectiles(fixture.sim, []);

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
