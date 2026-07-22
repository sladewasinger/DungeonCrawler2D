/** Covers the temporary playtest switch that leaves populated enemies inert. */
import { describe, expect, it } from "vitest";
import { makeSim } from "./integration/support.js";

describe("frozen enemies", () => {
  it("does not let a nearby hostile move or damage a player", () => {
    const sim = makeSim(1234, { testFixtures: false, freezeEnemies: true });
    const player = sim.addPlayer("Frozen tester", "frozen-client");
    const body = sim.getPlayerEntity(player.playerId)?.body;
    if (!body) throw new Error("joined player is missing");
    sim.endSpawnGrace(player.playerId);
    const enemy = sim.spawnEnemy("skeleton", body.x + 0.8, body.y);
    const start = { x: enemy.body.x, y: enemy.body.y, hp: sim.getPlayerEntity(player.playerId)?.hp };

    sim.step();

    expect(enemy.body).toMatchObject({ x: start.x, y: start.y });
    expect(sim.getPlayerEntity(player.playerId)?.hp).toBe(start.hp);
  });
});
