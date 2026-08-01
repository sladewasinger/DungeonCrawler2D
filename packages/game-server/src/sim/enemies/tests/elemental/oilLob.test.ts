import { describe, expect, it } from "vitest";
import { spawnEnemy } from "../../../core/helpers.js";
import { launchOilLob } from "../../elemental/oilLob.js";
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

  it("oils an authoritative direct hit and splashes the ground beneath it", () => {
    const fixture = createOilFixture();
    fixture.sim.enemies.delete(fixture.enemy.id);
    fixture.projectile.body.x = fixture.target.body.x - 0.6;
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
    expect(fixture.sim.areas.allTiles()).toEqual([
      { x: fixture.floor.x + 4, y: fixture.floor.y + 1, defId: "area-oil" },
      { x: fixture.floor.x + 5, y: fixture.floor.y + 1, defId: "area-oil" },
      { x: fixture.floor.x + 4, y: fixture.floor.y + 2, defId: "area-oil" },
      { x: fixture.floor.x + 5, y: fixture.floor.y + 2, defId: "area-oil" },
    ]);
    expect(fixture.sim.projectiles.size).toBe(0);
  });

  it("keeps nearby Pitchblooms from intercepting each other's lobs", () => {
    const fixture = createOilFixture();
    const neighbor = spawnEnemy(fixture.sim, {
      defId: "pitchbloom",
      x: fixture.floor.x + 1.5,
      y: fixture.floor.y + 1.5,
    });
    const neighborSlot = fixture.sim.enemies.get(neighbor.id);
    if (!neighborSlot) throw new Error("missing nearby Pitchbloom fixture");
    launchOilLob({
      sim: fixture.sim,
      enemy: neighborSlot,
      target: fixture.target.body,
    });

    stepProjectiles(fixture.sim, []);

    expect(fixture.sim.projectiles.size).toBe(2);
  });

  it("splashes at the blocked shield interception without oiling the player", () => {
    const fixture = createOilFixture();
    const target = fixture.sim.players.get(fixture.target.id);
    if (!target) throw new Error("missing target player fixture");
    target.blocking = true;
    target.entity.facing = { x: -1, y: 0 };
    fixture.projectile.body.x = fixture.target.body.x;
    fixture.projectile.body.y = fixture.target.body.y;
    fixture.projectile.body.z = fixture.target.body.z;
    delete fixture.projectile.vel;

    stepProjectiles(fixture.sim, []);

    expect(fixture.target.statuses).toEqual([]);
    expect(fixture.sim.areas.allTiles()).toEqual([
      { x: fixture.floor.x + 3, y: fixture.floor.y + 1, defId: "area-oil" },
      { x: fixture.floor.x + 4, y: fixture.floor.y + 1, defId: "area-oil" },
      { x: fixture.floor.x + 3, y: fixture.floor.y + 2, defId: "area-oil" },
      { x: fixture.floor.x + 4, y: fixture.floor.y + 2, defId: "area-oil" },
    ]);
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
