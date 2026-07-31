import { describe, expect, it } from "vitest";
import { stepEnemies } from "../../ai.js";
import {
  miniBossArenaEntryForPlayer,
  occupiesMiniBossArena,
} from "../../miniBossArena/runtime.js";
import {
  ARENA_ENEMY_TYPES,
  ORC_SHAMAN,
  ORC_WARRIOR,
  admittedArenaFixture,
  arenaFixture,
  placeEnemyBesidePlayer,
  primeOutsideWindup,
} from "./miniBossArenaAggroTestSupport.js";

describe("mini-boss arena aggro boundary", () => {
  it.each(ARENA_ENEMY_TYPES)(
    "keeps %s dormant for an outside entrant",
    (defId) => {
      const fixture = arenaFixture(defId);
      const before = { ...fixture.enemy.entity.body };

      expect(miniBossArenaEntryForPlayer(
        fixture.sim,
        fixture.player.entity.id,
      )).toBeDefined();
      stepEnemies(fixture.sim, []);

      expect(fixture.enemy.brain.targetId).toBeNull();
      expect(fixture.enemy.animation.state).toBe("idle");
      expect(fixture.enemy.entity.body).toMatchObject({
        x: before.x,
        y: before.y,
      });
      expect(fixture.sim.projectiles.size).toBe(0);
    },
  );

  it("requires occupant authority even when an entrant is physically inside", () => {
    const fixture = arenaFixture(ORC_WARRIOR);
    const center = fixture.arena.center;
    fixture.player.entity.body.x = center.x + 0.5;
    fixture.player.entity.body.y = center.y + 0.5;
    placeEnemyBesidePlayer({ ...fixture, distance: 0.8 });
    const hpBefore = fixture.player.entity.hp;

    stepEnemies(fixture.sim, []);

    expect(occupiesMiniBossArena(
      fixture.sim,
      fixture.player.entity.id,
    )).toBe(false);
    expect(fixture.enemy.brain.targetId).toBeNull();
    expect(fixture.enemy.animation.state).toBe("idle");
    expect(fixture.player.entity.hp).toBe(hpBefore);
  });

  it("clears stale ranged windup, memory, and motion outside the arena", () => {
    const fixture = arenaFixture(ORC_SHAMAN);
    primeOutsideWindup(fixture.enemy, fixture.player);

    stepEnemies(fixture.sim, []);

    expect(fixture.enemy.brain.targetId).toBeNull();
    expect(fixture.enemy.brain.rememberedTarget).toBeNull();
    expect(fixture.enemy.brain.memorySecondsRemaining).toBe(0);
    expect(fixture.enemy.brain.memorySearchSecondsRemaining).toBe(0);
    expect(fixture.enemy.rememberedRoute).toBeNull();
    expect(fixture.enemy.animation.state).toBe("idle");
    expect(fixture.enemy.entity.body.kx).toBe(0);
    expect(fixture.enemy.entity.body.ky).toBe(0);
    expect(fixture.sim.projectiles.size).toBe(0);
  });

  it("cancels an occupant windup when the occupant is physically outside", () => {
    const fixture = admittedArenaFixture(ORC_SHAMAN);
    placeEnemyBesidePlayer({ ...fixture, distance: 4 });
    stepEnemies(fixture.sim, []);
    expect(fixture.enemy.animation.state).toBe("windup");

    const outside = fixture.arena.gates[0]?.outside;
    if (!outside) throw new Error("arena has no gate");
    fixture.player.entity.body.x = outside.x;
    fixture.player.entity.body.y = outside.y;
    stepEnemies(fixture.sim, []);

    expect(occupiesMiniBossArena(
      fixture.sim,
      fixture.player.entity.id,
    )).toBe(true);
    expect(fixture.enemy.brain.targetId).toBeNull();
    expect(fixture.enemy.animation.state).toBe("idle");
    expect(fixture.sim.projectiles.size).toBe(0);
  });

  it("lets an admitted inside occupant activate melee enemies", () => {
    const fixture = admittedArenaFixture(ORC_WARRIOR);
    placeEnemyBesidePlayer({ ...fixture, distance: 0.8 });
    const hpBefore = fixture.player.entity.hp;

    stepEnemies(fixture.sim, []);

    expect(fixture.enemy.brain.targetId).toBe(fixture.player.entity.id);
    expect(fixture.enemy.animation.state).toBe("attack");
    expect(fixture.player.entity.hp).toBeLessThan(hpBefore);
  });

  it("lets an admitted inside occupant activate ranged enemies", () => {
    const fixture = admittedArenaFixture(ORC_SHAMAN);
    placeEnemyBesidePlayer({ ...fixture, distance: 4 });

    stepEnemies(fixture.sim, []);
    expect(fixture.enemy.brain.targetId).toBe(fixture.player.entity.id);
    expect(fixture.enemy.animation.state).toBe("windup");

    for (let tick = 0; tick < 5; tick++) stepEnemies(fixture.sim, []);
    expect(fixture.sim.projectiles.size).toBe(1);
  });

});
