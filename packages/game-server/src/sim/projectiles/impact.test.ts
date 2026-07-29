import { createBody, makeEntity, type EffectEvent } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { spawnEnemy } from "../core/helpers.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "../enemies/tests/enemyAiTestSupport.js";
import { realizeEffectEvents } from "../progression/statuses.js";
import { resolveProjectileImpact } from "./impact.js";

describe("projectile impacts", () => {
  it("attributes Spitter damage and poison without crashing", () => {
    const sim = createEnemyTestSim();
    const spot = findEnemyTestFloor(sim);
    const player = addEnemyTestPlayer(sim, spot);
    const enemyEntity = spawnEnemy(sim, {
      defId: "spitter",
      x: spot.x + 3,
      y: spot.y,
    });
    const projectile = makeEntity(
      "projectile",
      createBody(player.entity.body.x, player.entity.body.y, player.entity.body.z + 0.8),
      {
        id: "spit-test",
        ownerId: enemyEntity.id,
        tags: new Set(["spit"]),
      },
    );
    const events: EffectEvent[] = [];
    sim.rng.next = () => 0;

    resolveProjectileImpact({
      sim,
      projectile,
      point: player.entity.body,
      directHit: player.entity,
      effectEvents: events,
    });
    realizeEffectEvents(sim, events);

    const enemy = sim.enemies.get(enemyEntity.id);
    if (!enemy) throw new Error("missing Spitter fixture");
    expect(player.entity.hp).toBe(player.entity.maxHp - enemy.def.attack.damage);
    expect(player.entity.statuses).toContainEqual(expect.objectContaining({
      defId: "poisoned",
      sourceId: enemyEntity.id,
    }));
    expect(events).toContainEqual(expect.objectContaining({
      t: "hp",
      id: player.entity.id,
      sourceId: enemyEntity.id,
    }));
  });
});
