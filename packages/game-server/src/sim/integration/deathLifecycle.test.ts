import { describe, expect, it } from "vitest";
import { makeParty, makeSim } from "./support.js";

describe("authoritative death lifecycle", () => {
  it("moves suicide through downed and dead before blocking gameplay", () => {
    const sim = makeSim();
    const { aId } = makeParty(sim);
    const player = sim.getPlayerEntity(aId);
    if (!player) throw new Error("missing death lifecycle player");
    const enemy = sim.spawnEnemy("slime", player.body.x + 1, player.body.y);
    const enemyHp = enemy.hp;

    sim.queueAction(aId, { type: "suicide" });
    let snapshots = sim.step();
    expect(snapshots.get(aId)?.self).toMatchObject({ hp: 1, downed: true });

    sim.queueAction(aId, { type: "suicide" });
    snapshots = sim.step();
    expect(snapshots.get(aId)?.self.hp).toBe(0);
    expect(snapshots.get(aId)?.self.downed).toBeUndefined();

    const { x, y } = player.body;
    sim.handleInput(aId, {
      type: "input",
      seq: 100,
      projectedServerTick: sim.tick,
      moveX: 1,
      moveY: 0,
      jump: true,
      run: false,
    });
    sim.queueAction(aId, { type: "attack", dirX: 1, dirY: 0 });
    snapshots = sim.step();
    expect(player.body).toMatchObject({ x, y });
    expect(enemy.hp).toBe(enemyHp);
    expect(snapshots.get(aId)?.self.hp).toBe(0);
  });
});
