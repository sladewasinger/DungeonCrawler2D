import { TILE, type EffectEvent } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { ELEMENTAL_ENEMY_TUNING } from "../../elemental/configuration/elementalEnemyTuning.js";
import { stepDirectionalFlame } from "../../elemental/directionalFlame.js";
import { createFlameFixture } from "./flameTestFixtures.js";

describe("Chort directional flame", () => {
  it("applies one bounded hit and advances one segment per phase", () => {
    const fixture = createFlameFixture(1);
    const events: EffectEvent[] = [];
    const complete = stepDirectionalFlame({
      sim: fixture.sim,
      enemy: fixture.enemy,
      effectEvents: events,
    });

    expect(complete).toBe(false);
    expect(fixture.player.hp).toBe(28);
    expect(fixture.player.statuses).toEqual([
      expect.objectContaining({
        defId: ELEMENTAL_ENEMY_TUNING.directionalFlame.statusId,
        sourceId: fixture.enemy.entity.id,
      }),
    ]);
    expect(fixture.sim.areas.defAt(fixture.tileX + 1, fixture.tileY))
      .toBe("area-enemy-flame");
  });

  it("stops the entire remaining segment at blocked terrain", () => {
    const fixture = createFlameFixture(2);
    fixture.sim.world.replaceTileOverrides([{
      x: fixture.tileX + 1,
      y: fixture.tileY,
      tile: TILE.CraftingTable,
    }]);

    const complete = stepDirectionalFlame({
      sim: fixture.sim,
      enemy: fixture.enemy,
      effectEvents: [],
    });

    expect(complete).toBe(true);
    expect(fixture.player.hp).toBe(30);
    expect(fixture.sim.areas.size).toBe(0);
  });

  it("ignites oil once, consumes oiled, and keeps the Chort source", () => {
    const fixture = createFlameFixture(1);
    const events: EffectEvent[] = [];
    fixture.sim.effects.applyStatus({
      entity: fixture.player,
      statusId: "oiled",
      sourceId: "pitchbloom-source",
      events,
    });
    fixture.sim.areas.place({
      defId: "area-oil",
      x: fixture.tileX + 1,
      y: fixture.tileY,
      steps: 0,
      sourceId: "pitchbloom-source",
    });

    stepDirectionalFlame({
      sim: fixture.sim,
      enemy: fixture.enemy,
      effectEvents: events,
    });

    expect(fixture.player.statuses).toEqual([
      expect.objectContaining({
        defId: "on-fire",
        sourceId: fixture.enemy.entity.id,
      }),
    ]);
    expect(fixture.sim.areas.defAt(fixture.tileX + 1, fixture.tileY))
      .toBe("area-fire");
    expect(fixture.sim.areas.sourceIdAt(fixture.tileX + 1, fixture.tileY))
      .toBe(fixture.enemy.entity.id);
  });

  it("includes the target tile in a diagonal flame path", () => {
    const fixture = createFlameFixture(1, 1);
    expect(fixture.enemy.elementalAttack?.cells).toContainEqual({
      x: Math.floor(fixture.player.body.x),
      y: Math.floor(fixture.player.body.y),
    });
  });

  it.each([
    ["east", 2, 0],
    ["west", -2, 0],
    ["north", 0, -2],
    ["south", 0, 2],
    ["north-east", 2, -1],
    ["north-west", -2, -1],
    ["south-east", 2, 1],
    ["south-west", -2, 1],
    ["steep north-east", 1, -2],
    ["steep north-west", -1, -2],
    ["steep south-east", 1, 2],
    ["steep south-west", -1, 2],
  ])("aims its primary flame at a stationary target to the %s", (
    _direction,
    offsetX,
    offsetY,
  ) => {
    const fixture = createFlameFixture(offsetX, offsetY);

    for (let segment = 0; segment < 3; segment += 1) {
      stepDirectionalFlame({
        sim: fixture.sim,
        enemy: fixture.enemy,
        effectEvents: [],
      });
    }

    expect(fixture.player.hp).toBe(28);
    expect(fixture.sim.areas.defAt(
      Math.floor(fixture.player.body.x),
      Math.floor(fixture.player.body.y),
    )).toBe("area-enemy-flame");
  });
});
