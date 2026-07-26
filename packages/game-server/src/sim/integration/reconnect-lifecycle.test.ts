/** Proves reconnect grace pauses dead and downed player lifecycle transitions. */
import { PLAYER_MAX_HP, RESPAWN_DELAY_TICKS, TICK_RATE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { DOWNED_DURATION_TICKS } from "../deathTestSupport.js";
import { makeSim, stepN } from "./support.js";

describe("GameSim disconnected lifecycle continuity", () => {
  it("freezes a pending dead-screen respawn and resumes its remaining delay", () => {
    const sim = makeSim();
    const player = sim.addPlayer("Dead", "dead-client");
    const entity = sim.getPlayerEntity(player.playerId)!;
    entity.hp = 0;
    sim.step();
    expect(entity.hp).toBe(1);
    sim.queueAction(player.playerId, { type: "suicide" });
    sim.step();
    expect(entity.hp).toBe(0);
    const frozen = { x: entity.body.x, y: entity.body.y, z: entity.body.z };

    sim.markDisconnected(player.playerId);
    stepN(sim, 100);
    expect(entity.hp).toBe(0);
    expect(entity.body).toMatchObject(frozen);

    const resumed = sim.addPlayer("Dead", "dead-client", player.resumeToken);
    expect(resumed).toMatchObject({ resumed: true, spawn: frozen });
    expect(entity.hp).toBe(0);
    stepN(sim, RESPAWN_DELAY_TICKS - 1);
    expect(entity.hp).toBe(0);
    sim.step();
    expect(entity.hp).toBe(PLAYER_MAX_HP);
  });

  it("freezes downed bleedout and continues its remaining 15 seconds after resume", () => {
    const sim = makeSim();
    const player = sim.addPlayer("Downed", "downed-client");
    const entity = sim.getPlayerEntity(player.playerId)!;
    entity.hp = 0;
    sim.step();
    expect(entity.hp).toBe(1);
    const frozen = { x: entity.body.x, y: entity.body.y, z: entity.body.z };

    sim.markDisconnected(player.playerId);
    stepN(sim, TICK_RATE * 70);
    expect(entity.hp).toBe(1);
    expect(entity.body).toMatchObject(frozen);

    expect(sim.addPlayer("Downed", "downed-client", player.resumeToken)).toMatchObject({ resumed: true, spawn: frozen });
    expect(entity.downedUntil).toBe(sim.tick + DOWNED_DURATION_TICKS);
    expect(sim.step().get(player.playerId)?.self).toMatchObject({ hp: 1, downed: true, x: frozen.x, y: frozen.y });
    stepN(sim, DOWNED_DURATION_TICKS - 2);
    expect(entity.hp).toBe(1);
    sim.step();
    expect(entity.hp).toBe(0);
    expect(entity.body).toMatchObject(frozen);
  });
});
