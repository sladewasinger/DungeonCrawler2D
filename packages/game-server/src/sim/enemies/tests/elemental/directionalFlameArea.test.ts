import type { EffectEvent } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { effectTargetFor, spawnEnemy } from "../../../core/helpers.js";
import { igniteEntity } from "../../../progression/elemental/elementalIgnition.js";
import { stepDirectionalFlame } from "../../elemental/directionalFlame.js";
import { placeDirectionalFlameArea } from "../../elemental/directionalFlameArea.js";
import { createFlameFixture } from "./flameTestFixtures.js";

const ENEMY_FLAME_AREA_ID = "area-enemy-flame";

describe("Chort flame areas", () => {
  it("lasts five seconds and refreshes repeated placement", () => {
    const fixture = createFlameFixture(1);
    const cell = { x: fixture.tileX + 1, y: fixture.tileY };

    stepDirectionalFlame({
      sim: fixture.sim,
      enemy: fixture.enemy,
      effectEvents: [],
    });
    fixture.sim.areas.tick(4.9, () => 0);
    expect(fixture.sim.areas.defAt(cell.x, cell.y)).toBe(ENEMY_FLAME_AREA_ID);

    placeDirectionalFlameArea({
      sim: fixture.sim,
      enemy: fixture.enemy,
      effectEvents: [],
      cell,
    });
    fixture.sim.areas.tick(4.9, () => 0);
    expect(fixture.sim.areas.defAt(cell.x, cell.y)).toBe(ENEMY_FLAME_AREA_ID);

    fixture.sim.areas.tick(0.2, () => 0);
    expect(fixture.sim.areas.defAt(cell.x, cell.y)).toBeNull();
  });

  it("does not damage or ignite another Chort with directional flame fire", () => {
    const fixture = createFlameFixture(1);
    const target = spawnEnemy(fixture.sim, {
      defId: "chort",
      x: fixture.enemy.entity.body.x + 1,
      y: fixture.enemy.entity.body.y,
    });
    const events: EffectEvent[] = [];

    const applied = fixture.sim.effects.modifyHealth({
      entity: target,
      amount: -fixture.enemy.def.attack.damage,
      events,
      opts: {
        sourceTags: ["fire", ...fixture.enemy.def.tags],
        sourceId: fixture.enemy.entity.id,
      },
      target: effectTargetFor(fixture.sim, target),
    });
    const ignited = igniteEntity({
      sim: fixture.sim,
      entity: target,
      effectEvents: events,
      sourceId: fixture.enemy.entity.id,
    });

    expect(applied).toBe(0);
    expect(target.hp).toBe(target.maxHp);
    expect(ignited).toBe(false);
    expect(target.statuses).toEqual([]);
  });
});
