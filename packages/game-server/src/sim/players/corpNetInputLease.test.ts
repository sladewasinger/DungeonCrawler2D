import { CORPNET_INPUT_LEASE_TICKS } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  findFlatArena,
  input,
  makeSim,
  stepN,
  teleport,
} from "../integration/support.js";

describe("CorpNet input lease", () => {
  it("stops stale held movement without changing standard input behavior", () => {
    const corpNet = movingPlayer("corpnet");
    stepN(corpNet.sim, CORPNET_INPUT_LEASE_TICKS + 2);
    const leasedPosition = corpNet.entity.body.x;
    stepN(corpNet.sim, 3);
    expect(corpNet.entity.body.x).toBeCloseTo(leasedPosition, 5);

    const standard = movingPlayer(null);
    stepN(standard.sim, CORPNET_INPUT_LEASE_TICKS + 2);
    const standardPosition = standard.entity.body.x;
    stepN(standard.sim, 3);
    expect(standard.entity.body.x).toBeGreaterThan(standardPosition);
  });
});

function movingPlayer(profile: "corpnet" | null) {
  const sim = makeSim(902, { freezeEnemies: true });
  const player = sim.addPlayer({ name: "Lease tester", clientId: "lease-client" });
  const entity = sim.getPlayerEntity(player.playerId);
  if (!entity) throw new Error("joined player is missing");
  const start = findFlatArena({ sim, anchor: { x: 5.5, y: 5.5 } });
  teleport({ entity, x: start.x, y: start.y, sim });
  sim.configureNetworkProfile(player.playerId, profile);
  sim.handleInput(player.playerId, input({
    seq: 1,
    moveX: 1,
    moveY: 0,
    projectedServerTick: sim.tick,
  }));
  return { sim, entity };
}
