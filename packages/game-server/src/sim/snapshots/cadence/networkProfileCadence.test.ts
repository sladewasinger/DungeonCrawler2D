import {
  serverSnapshotDeltaSchema,
  type ServerSnapshotDelta,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { input, makeSim, teleport } from "../../integration/support.js";

function delta(snapshot: unknown): ServerSnapshotDelta {
  return serverSnapshotDeltaSchema.parse(snapshot);
}

describe("CorpNet snapshot cadence", () => {
  it("does not advance a delta cursor for a skipped dynamic delivery", () => {
    const sim = makeSim(700, { freezeEnemies: true });
    const mover = sim.addPlayer({ name: "Mover", clientId: "mover" });
    const observer = sim.addPlayer({ name: "Observer", clientId: "observer" });
    const moverEntity = sim.getPlayerEntity(mover.playerId);
    const observerEntity = sim.getPlayerEntity(observer.playerId);
    if (!moverEntity || !observerEntity) throw new Error("missing players");
    teleport({ entity: moverEntity, x: observer.spawn.x + 1, y: observer.spawn.y, sim });
    teleport({ entity: observerEntity, x: observer.spawn.x, y: observer.spawn.y, sim });
    sim.configureSnapshotMode(observer.playerId, "delta-v1");

    const baseline = delta(sim.stepReplicated().get(observer.playerId));
    sim.configureNetworkProfile(observer.playerId, "corpnet");
    sim.handleInput(mover.playerId, input({ seq: 1, moveX: 1, moveY: 0, jump: false }));
    const delivered = delta(sim.stepReplicated().get(observer.playerId));
    sim.handleInput(mover.playerId, input({ seq: 2, moveX: 1, moveY: 0, jump: false }));
    expect(sim.stepReplicated().has(observer.playerId)).toBe(false);

    const resumed = delta(sim.stepReplicated().get(observer.playerId));
    expect(delivered.baseTick).toBe(baseline.tick);
    expect(resumed.baseTick).toBe(delivered.tick);
  });
});
