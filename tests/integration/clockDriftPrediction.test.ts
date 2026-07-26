import { LEVEL, World, type ClientMessage, type MoveInput } from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import { applySnapshot } from "../../packages/client/src/net/apply.js";
import { Connection } from "../../packages/client/src/net/connection.js";
import { fixedRateStepPlan } from "../../packages/game-server/src/server/fixedRateLoop.js";
import {
  findFlatArena,
  makeSim,
  teleport,
} from "../../packages/game-server/src/sim/integration/support.js";

const WALK: MoveInput = {
  moveX: 1,
  moveY: 0,
  jump: false,
  run: false,
};
const IDLE: MoveInput = {
  moveX: 0,
  moveY: 0,
  jump: false,
  run: false,
};

function runDriftSchedule(
  sim: ReturnType<typeof makeSim>,
  playerId: string,
  connection: Connection,
): number {
  let nextServerTickAt = 50;
  let serverSteps = 0;
  for (let wallTime = 10; wallTime <= 5_000; wallTime += 10) {
    if (wallTime % 50 === 0) {
      const input = wallTime <= 2_000 ? WALK : IDLE;
      if (wallTime === 2_050) connection.sendInputEdge(input);
      connection.sampleInput(input);
    }
    if (wallTime % 60 !== 0) continue;
    const plan = fixedRateStepPlan(wallTime, nextServerTickAt, 50);
    nextServerTickAt = plan.nextTickAt;
    for (let step = 0; step < plan.steps; step++) {
      const snapshot = sim.step().get(playerId);
      if (snapshot) applySnapshot(connection, snapshot);
      serverSteps++;
    }
  }
  return serverSteps;
}

describe("prediction under host timer drift", () => {
  it("keeps a 20 Hz client aligned when server callbacks arrive at 17 Hz", () => {
    const sim = makeSim(719, { testFixtures: true, freezeEnemies: true });
    const joined = sim.addPlayer("Clock drift", "clock-drift-client");
    const serverPlayer = sim.getPlayerEntity(joined.playerId);
    if (!serverPlayer) throw new Error("expected joined server player");
    const arena = findFlatArena(sim, joined.spawn.x, joined.spawn.y);
    teleport(serverPlayer, arena.x, arena.y, sim);
    const connection = new Connection(
      "ws://integration.test",
      "Clock drift",
      "clock-drift-client",
    );
    connection.status = "connected";
    connection.world = new World(
      sim.world.worldSeed,
      sim.world.floor,
      LEVEL.Sandbox,
    );
    const initial = sim.step().get(joined.playerId);
    if (!initial) throw new Error("expected initial authoritative snapshot");
    applySnapshot(connection, initial);
    vi.spyOn(connection, "send").mockImplementation((message: ClientMessage) => {
      if (message.type === "input") sim.handleInput(joined.playerId, message);
    });

    connection.sendInputEdge(WALK);
    const serverSteps = runDriftSchedule(sim, joined.playerId, connection);

    expect(serverSteps).toBe(99);
    expect(connection.body?.x).toBeCloseTo(serverPlayer.body.x, 10);
    expect(connection.body?.y).toBeCloseTo(serverPlayer.body.y, 10);
    expect(connection.prediction.pendingStepCount).toBeLessThanOrEqual(1);
  });
});
