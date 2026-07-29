import type { EffectEvent } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { spawnEnemy } from "../../core/helpers.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "../../enemies/tests/enemyAiTestSupport.js";
import { igniteEntity } from "./elementalIgnition.js";
import { realizeEffectEvents } from "../statuses.js";

describe("elemental ignition", () => {
  it("consumes oil and cannot refresh an accepted burn", () => {
    const sim = createEnemyTestSim();
    const player = addEnemyTestPlayer(sim, findEnemyTestFloor(sim));
    const events: EffectEvent[] = [];
    sim.effects.applyStatus({
      entity: player.entity,
      statusId: "oiled",
      sourceId: "oil-source",
      events,
    });
    expect(igniteEntity({
      sim,
      entity: player.entity,
      sourceId: "fire-source",
      effectEvents: events,
    })).toBe(true);
    const burning = player.entity.statuses[0];
    if (!burning) throw new Error("missing burning status");
    burning.remaining = 2;
    expect(igniteEntity({
      sim,
      entity: player.entity,
      sourceId: "other-fire",
      effectEvents: events,
    })).toBe(false);
    expect(player.entity.statuses).toEqual([
      expect.objectContaining({
        defId: "on-fire",
        remaining: 2,
        sourceId: "fire-source",
      }),
    ]);
  });

  it("retains the player source through delayed burning damage", () => {
    const sim = createEnemyTestSim();
    const spot = findEnemyTestFloor(sim);
    const player = addEnemyTestPlayer(sim, spot);
    const entity = spawnEnemy(sim, {
      defId: "slime",
      x: spot.x + 2,
      y: spot.y,
    });
    const enemy = sim.enemies.get(entity.id);
    if (!enemy) throw new Error("missing burn attribution target");
    const events: EffectEvent[] = [];
    sim.effects.applyStatus({
      entity,
      statusId: "on-fire",
      sourceId: player.entity.id,
      events,
    });
    sim.effects.tick({
      entity,
      dt: 1,
      events,
      target: {},
      rng: () => 0,
    });
    realizeEffectEvents(sim, events);
    expect(enemy.lastDamageSourceId).toBe(player.entity.id);
  });
});
