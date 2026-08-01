import { faceEntity } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { addEnemyTestPlayer } from "../enemies/tests/enemyAiTestSupport.js";
import {
  advanceMeleeTick,
  attack,
  createMeleeFixture,
  spawnSpitter,
} from "./melee/testSupport.js";

describe("active player melee attacks", () => {
  it("hits an enemy entered by sprinting during the visible swing window", () => {
    const fixture = createMeleeFixture();
    const enemy = spawnSpitter(fixture, 3);

    attack(fixture);
    expect(enemy.hp).toBe(enemy.maxHp);

    fixture.player.entity.body.x += 0.5;
    advanceMeleeTick(fixture, 1);

    expect(enemy.hp).toBe(enemy.maxHp - 9);
  });

  it("hits all grouped enemies in the cone on the same swing", () => {
    const fixture = createMeleeFixture();
    const firstEnemy = spawnSpitter(fixture, 1);
    const secondEnemy = spawnSpitter(fixture, 1.5);

    attack(fixture);

    expect(firstEnemy.hp).toBe(firstEnemy.maxHp - 9);
    expect(secondEnemy.hp).toBe(secondEnemy.maxHp - 9);
  });

  it("does not damage the same enemy again while the swing remains active", () => {
    const fixture = createMeleeFixture();
    const enemy = spawnSpitter(fixture, 1);

    attack(fixture);
    advanceMeleeTick(fixture, 1);
    advanceMeleeTick(fixture, 2);
    advanceMeleeTick(fixture, 3);

    expect(enemy.hp).toBe(enemy.maxHp - 9);
  });

  it("consumes a blocked player contact before their guard can be released", () => {
    const fixture = createMeleeFixture();
    const defender = addEnemyTestPlayer(
      fixture.sim,
      { x: fixture.spot.x + 1, y: fixture.spot.y },
      "defender",
    );
    defender.blocking = true;
    faceEntity(defender.entity, -1, 0);

    attack(fixture);
    defender.blocking = false;
    advanceMeleeTick(fixture, 1);

    expect(defender.entity.hp).toBe(defender.entity.maxHp);
  });

  it("keeps party fallback suppressed after a hostile has contacted the temporal swing", () => {
    const fixture = createMeleeFixture();
    const partyMember = addEnemyTestPlayer(
      fixture.sim,
      { x: fixture.spot.x, y: fixture.spot.y + 5 },
      "party-member",
    );
    fixture.player.partyId = "party";
    partyMember.partyId = "party";
    const enemy = spawnSpitter(fixture, 1);

    attack(fixture);
    enemy.body.x = fixture.spot.x - 5;
    partyMember.entity.body.x = fixture.spot.x + 1;
    partyMember.entity.body.y = fixture.spot.y;
    advanceMeleeTick(fixture, 1);

    expect(partyMember.entity.hp).toBe(partyMember.entity.maxHp);
  });

  it("keeps its accepted direction, weapon profile, and status payload after an equip change", () => {
    const fixture = createMeleeFixture();
    const enemy = spawnSpitter(fixture, 3);
    fixture.sim.rng.next = () => 0;

    attack(fixture);
    fixture.player.entity.body.x += 0.5;
    fixture.player.weapon = "hammer";
    faceEntity(fixture.player.entity, 0, 1);
    advanceMeleeTick(fixture, 1);

    expect(enemy.hp).toBe(enemy.maxHp - 9);
    expect(enemy.statuses).toContainEqual(expect.objectContaining({ defId: "bleeding" }));
    expect(enemy.statuses).not.toContainEqual(expect.objectContaining({ defId: "slowed" }));
  });

  it("resolves at the 150 ms boundary but never at 200 ms", () => {
    const fixture = createMeleeFixture();
    const boundaryEnemy = spawnSpitter(fixture, 3.6);

    attack(fixture);
    advanceMeleeTick(fixture, 1);
    advanceMeleeTick(fixture, 2);
    fixture.player.entity.body.x += 1.2;
    advanceMeleeTick(fixture, 3);

    expect(boundaryEnemy.hp).toBe(boundaryEnemy.maxHp - 9);

    const expiredEnemy = spawnSpitter(fixture, 2.2);
    advanceMeleeTick(fixture, 4);

    expect(expiredEnemy.hp).toBe(expiredEnemy.maxHp);
  });
});
