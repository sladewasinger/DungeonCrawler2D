import {
  RESPAWN_DELAY_SECONDS,
  RESPAWN_DELAY_TICKS,
  TICK_RATE,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { makeParty, makeSim } from "./support.js";

describe("authoritative respawn timing", () => {
  it("exports the same five-second delay for solo and party deaths", () => {
    expect(RESPAWN_DELAY_SECONDS).toBe(5);
    expect(RESPAWN_DELAY_TICKS).toBe(5 * TICK_RATE);
  });

  it("snapshots a five-second deadline after a solo player gives up", () => {
    const sim = makeSim();
    const player = sim.addPlayer({ name: "Solo", clientId: "solo-respawn-timing" });
    sim.getPlayerEntity(player.playerId)!.hp = 0;
    sim.step();
    sim.queueAction(player.playerId, { type: "suicide" });
    const snapshot = sim.step().get(player.playerId);
    if (!snapshot) throw new Error("missing solo death snapshot");
    expect(snapshot.self.respawnAtTick).toBe(snapshot.tick + RESPAWN_DELAY_TICKS);
  });

  it("snapshots the same five-second deadline for a party player", () => {
    const sim = makeSim();
    const { aId } = makeParty(sim);
    sim.getPlayerEntity(aId)!.hp = 0;
    sim.step();
    sim.queueAction(aId, { type: "suicide" });
    const snapshot = sim.step().get(aId);
    if (!snapshot) throw new Error("missing party death snapshot");
    expect(snapshot.self.respawnAtTick).toBe(snapshot.tick + RESPAWN_DELAY_TICKS);
  });
});
