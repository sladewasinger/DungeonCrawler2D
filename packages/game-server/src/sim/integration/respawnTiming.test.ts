import {
  PARTY_RESPAWN_DELAY_SECONDS,
  PARTY_RESPAWN_DELAY_TICKS,
  SOLO_RESPAWN_DELAY_SECONDS,
  SOLO_RESPAWN_DELAY_TICKS,
  TICK_RATE,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { makeParty, makeSim } from "./support.js";

describe("authoritative respawn timing", () => {
  it("exports named ten-second solo and fifteen-second party delays", () => {
    expect(SOLO_RESPAWN_DELAY_SECONDS).toBe(10);
    expect(PARTY_RESPAWN_DELAY_SECONDS).toBe(15);
    expect(SOLO_RESPAWN_DELAY_TICKS).toBe(10 * TICK_RATE);
    expect(PARTY_RESPAWN_DELAY_TICKS).toBe(15 * TICK_RATE);
  });

  it("snapshots a ten-second deadline for an ordinary solo death", () => {
    const sim = makeSim();
    const player = sim.addPlayer("Solo", "solo-respawn-timing");
    sim.queueAction(player.playerId, { type: "suicide" });
    const snapshot = sim.step().get(player.playerId);
    if (!snapshot) throw new Error("missing solo death snapshot");
    expect(snapshot.self.respawnAtTick).toBe(snapshot.tick + SOLO_RESPAWN_DELAY_TICKS);
  });

  it("snapshots a fifteen-second deadline while the dead player is in a party", () => {
    const sim = makeSim();
    const { aId } = makeParty(sim);
    sim.queueAction(aId, { type: "suicide" });
    const snapshot = sim.step().get(aId);
    if (!snapshot) throw new Error("missing party death snapshot");
    expect(snapshot.self.respawnAtTick).toBe(snapshot.tick + PARTY_RESPAWN_DELAY_TICKS);
  });
});
