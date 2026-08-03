import { describe, expect, it } from "vitest";
import { stepEnemies } from "../../ai.js";
import { moveEnemy } from "../../ai/enemyMovement.js";
import {
  ORC_WARLORD,
  admittedArenaFixture,
  admittedFullArenaFixture,
} from "./miniBossArenaAggroTestSupport.js";

describe("mini-boss arena leader", () => {
  it("reserves a capped target slot for an admitted arena leader", () => {
    const ordinaryFixture = admittedFullArenaFixture();
    delete ordinaryFixture.leader.arenaLeader;
    positionLeaderForTargeting(ordinaryFixture);
    stepEnemies(ordinaryFixture.sim, []);
    const ordinaryAssignments = assignedEnemies(
      ordinaryFixture.sim,
      ordinaryFixture.player.entity.id,
    );
    expect(ordinaryAssignments.length).toBeGreaterThan(0);
    expect(ordinaryAssignments.length).toBeLessThan(ordinaryFixture.sim.enemies.size);

    const fixture = admittedFullArenaFixture();
    positionLeaderForTargeting(fixture);
    stepEnemies(fixture.sim, []);

    expect(fixture.leader.def.id).toBe(ORC_WARLORD);
    expect(fixture.leader.brain.targetId).toBe(fixture.player.entity.id);
    const leaderAssignments = assignedEnemies(fixture.sim, fixture.player.entity.id);
    expect(leaderAssignments.length).toBeGreaterThan(0);
    expect(leaderAssignments).toHaveLength(ordinaryAssignments.length);
    expect(leaderAssignments).toContain(fixture.leader);
    expect(leaderAssignments.filter((enemy) => !enemy.arenaLeader).length)
      .toBeLessThan(ordinaryAssignments.length);
    expect(leaderAttacksWithin(fixture)).toBe(true);
  });

  it("recovers inward after guard separation reaches the final arena tile", () => {
    const fixture = admittedArenaFixture(ORC_WARLORD);
    const { enemy, player, sim } = fixture;
    const home = enemy.home;
    if (!home) throw new Error("arena leader lacks home bounds");
    player.entity.body.x = fixture.arena.center.x + 0.5;
    player.entity.body.y = home.y1 - 0.5;
    player.entity.facing = { x: 0, y: 1 };
    player.blocking = true;
    enemy.entity.body.x = player.entity.body.x;
    enemy.entity.body.y = home.y1 - 0.25;
    enemy.entity.body.z = sim.world.groundAt(
      enemy.entity.body.x,
      enemy.entity.body.y,
    );

    moveEnemy({
      sim,
      enemy,
      move: { moveX: 0, moveY: 0, jump: false },
      graced: [],
    });

    const separatedY = enemy.entity.body.y;
    expect(Math.floor(separatedY)).toBe(home.y1);
    expect(separatedY).toBeLessThan(home.y1 + 1);
    player.blocking = false;
    moveEnemy({
      sim,
      enemy,
      move: { moveX: 0, moveY: -1, jump: false },
      graced: [],
    });

    expect(enemy.entity.body.y).toBeLessThan(separatedY);
  });
});

function positionLeaderForTargeting(fixture: ReturnType<typeof admittedFullArenaFixture>): void {
  const { leader, player, sim } = fixture;
  const home = leader.home;
  if (!home) throw new Error("arena leader lacks home bounds");
  player.entity.hp = 100_000;
  player.entity.maxHp = 100_000;
  leader.entity.body.x = home.x0 + 0.5;
  leader.entity.body.y = home.y1 - 0.25;
  leader.entity.body.z = sim.world.groundAt(leader.entity.body.x, leader.entity.body.y);
}

function assignedEnemies(
  sim: ReturnType<typeof admittedFullArenaFixture>["sim"],
  playerId: string,
) {
  return [...sim.enemies.values()].filter((enemy) =>
    enemy.brain.targetId === playerId
  );
}

function leaderAttacksWithin(
  fixture: ReturnType<typeof admittedFullArenaFixture>,
): boolean {
  for (let tick = 0; tick < 200; tick += 1) {
    stepEnemies(fixture.sim, []);
    if (fixture.leader.animation.state === "attack") return true;
  }
  return false;
}
