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

  it("limits diagonal flames to cells within three Euclidean tiles", () => {
    const fixture = createFlameFixture(1, 1);
    expect(fixture.enemy.elementalAttack?.maximumSegments).toBe(2);
  });
});
