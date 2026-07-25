/** Exercises full-rate client prediction against real authoritative simulation snapshots. */
import {
  LEVEL,
  World,
  type ClientInput,
  type ClientMessage,
  type MoveInput,
} from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import { applySnapshot } from "../../packages/client/src/net/apply.js";
import { Connection } from "../../packages/client/src/net/connection.js";
import {
  findFlatArena,
  makeSim,
  teleport,
} from "../../packages/game-server/src/sim/integration/support.js";

const HELD_MOVE: MoveInput = {
  moveX: 1,
  moveY: 0,
  jump: false,
  run: false,
};

function expectSamePosition(connection: Connection, serverX: number, serverY: number): void {
  expect(connection.body?.x).toBeCloseTo(serverX, 10);
  expect(connection.body?.y).toBeCloseTo(serverY, 10);
}

describe("prediction integration", () => {
  it("keeps 1,000 held ticks aligned with monotonic full-rate input", () => {
    const sim = makeSim(717, { testFixtures: true, freezeEnemies: true });
    const joined = sim.addPlayer("Predictor", "prediction-client");
    const serverPlayer = sim.getPlayerEntity(joined.playerId);
    if (!serverPlayer) throw new Error("expected joined server player");
    const arena = findFlatArena(sim, joined.spawn.x, joined.spawn.y);
    teleport(serverPlayer, arena.x, arena.y, sim);
    const connection = new Connection("ws://integration.test", "Predictor", "prediction-client");
    connection.status = "connected";
    connection.world = new World(sim.world.worldSeed, sim.world.floor, LEVEL.Sandbox);

    const initial = sim.step().get(joined.playerId);
    if (!initial) throw new Error("expected initial authoritative snapshot");
    applySnapshot(connection, initial);

    const sentInputs: ClientInput[] = [];
    vi.spyOn(connection, "send").mockImplementation((message: ClientMessage) => {
      if (message.type !== "input") return;
      sentInputs.push(message);
      sim.handleInput(joined.playerId, message);
    });
    connection.sendInputEdge(HELD_MOVE);

    let deliveredSnapshots = 0;
    let droppedSnapshot = false;
    for (let localTick = 1; localTick <= 1_000; localTick++) {
      connection.sampleInput(HELD_MOVE);
      const snapshot = sim.stepReplicated().get(joined.playerId);
      if (!snapshot || snapshot.type !== "snapshot") continue;
      if (!droppedSnapshot && deliveredSnapshots === 4) {
        droppedSnapshot = true;
        continue;
      }
      deliveredSnapshots++;
      applySnapshot(connection, snapshot);
      expectSamePosition(connection, serverPlayer.body.x, serverPlayer.body.y);
    }
    const idle = { moveX: 0, moveY: 0, jump: false, run: false };
    connection.sendInputEdge(idle);
    connection.sampleInput(idle);
    const stopped = sim.stepReplicated().get(joined.playerId);
    if (stopped?.type === "snapshot") applySnapshot(connection, stopped);

    expect(sentInputs).toHaveLength(1_003);
    expect(sentInputs.every((input, index) => input.seq === index + 1))
      .toBe(true);
    expect(sentInputs.every((input, index) =>
      index === 0 ||
      input.projectedServerTick >=
        (sentInputs[index - 1]?.projectedServerTick ?? 0)))
      .toBe(true);
    expect(droppedSnapshot).toBe(true);
    expect(deliveredSnapshots).toBeGreaterThanOrEqual(499);
    expect(deliveredSnapshots).toBeLessThan(1_000);
    expect(connection.networkMetrics.snapshot(performance.now()).maximumCorrectionError)
      .toBeLessThan(1e-9);
  });
});
