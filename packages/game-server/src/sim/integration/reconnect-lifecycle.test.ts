/** Proves reconnect grace pauses dead and downed player lifecycle transitions. */
import { PLAYER_MAX_HP, TICK_RATE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { makeSim, stepN, teleport } from "./support.js";

describe("GameSim disconnected lifecycle continuity", () => {
  it("freezes a pending respawn and resumes with its remaining delay", () => {
    const sim = makeSim();
    const player = sim.addPlayer("Dead", "dead-client");
    const entity = sim.getPlayerEntity(player.playerId)!;
    entity.hp = 0;
    sim.step();
    const frozen = { x: entity.body.x, y: entity.body.y, z: entity.body.z };

    sim.markDisconnected(player.playerId);
    stepN(sim, 100);
    expect(entity.hp).toBe(0);
    expect(entity.body).toMatchObject(frozen);

    const resumed = sim.addPlayer("Dead", "dead-client", player.resumeToken);
    expect(resumed).toMatchObject({ resumed: true, spawn: frozen });
    expect(entity.hp).toBe(0);
    stepN(sim, 39);
    expect(entity.hp).toBe(0);
    sim.step();
    expect(entity.hp).toBe(PLAYER_MAX_HP);
  });

  it("freezes party bleedout and continues its remaining minute after resume", () => {
    const sim = makeSim();
    const ally = sim.addPlayer("Ally", "ally-client");
    const player = sim.addPlayer("Downed", "downed-client");
    const entity = sim.getPlayerEntity(player.playerId)!;
    teleport(entity, ally.spawn.x + 2, ally.spawn.y, sim);
    sim.queueAction(ally.playerId, { type: "party", op: "invite", target: player.playerId });
    sim.step();
    sim.queueAction(player.playerId, { type: "party", op: "accept" });
    sim.step();
    entity.hp = 0;
    sim.step();
    expect(entity.hp).toBe(1);
    const frozen = { x: entity.body.x, y: entity.body.y, z: entity.body.z };

    sim.markDisconnected(player.playerId);
    stepN(sim, TICK_RATE * 70);
    expect(entity.hp).toBe(1);
    expect(entity.body).toMatchObject(frozen);

    expect(sim.addPlayer("Downed", "downed-client", player.resumeToken)).toMatchObject({ resumed: true, spawn: frozen });
    expect(entity.downedUntil).toBe(sim.tick + TICK_RATE * 60);
    expect(sim.step().get(player.playerId)?.self).toMatchObject({ hp: 1, downed: true, x: frozen.x, y: frozen.y });
    stepN(sim, TICK_RATE * 60 - 2);
    expect(entity.hp).toBe(1);
    sim.step();
    expect(entity.hp).toBe(0);
    expect(entity.body).toMatchObject(frozen);
  });
});
