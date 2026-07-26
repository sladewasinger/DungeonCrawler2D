/** Exercises full-rate client prediction against real authoritative simulation snapshots. */
import {
  LEVEL,
  World,
  type ClientInput,
  type ClientMessage,
  type MoveInput,
  type ServerSnapshot,
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
const IDLE: MoveInput = { moveX: 0, moveY: 0, jump: false, run: false };

function expectSamePosition(connection: Connection, serverX: number, serverY: number): void {
  expect(connection.body?.x).toBeCloseTo(serverX, 10);
  expect(connection.body?.y).toBeCloseTo(serverY, 10);
}

function stepDelayedServer(
  sim: ReturnType<typeof makeSim>,
  playerId: string,
  delayedInputs: Map<number, ClientInput[]>,
): ServerSnapshot | undefined {
  for (const message of delayedInputs.get(sim.tick) ?? []) {
    sim.handleInput(playerId, message);
  }
  delayedInputs.delete(sim.tick);
  const snapshot = sim.stepReplicated().get(playerId);
  return snapshot?.type === "snapshot" ? snapshot : undefined;
}

function runDelayedMovement(
  sim: ReturnType<typeof makeSim>,
  playerId: string,
  connection: Connection,
  delayedInputs: Map<number, ClientInput[]>,
  delayedSnapshots: Map<number, ServerSnapshot>,
): void {
  for (let wallTick = 1; wallTick <= 100; wallTick++) {
    const input = wallTick <= 25 ? HELD_MOVE : IDLE;
    if (wallTick === 26) connection.sendInputEdge(input);
    connection.sampleInput(input);
    const snapshot = stepDelayedServer(sim, playerId, delayedInputs);
    if (snapshot) delayedSnapshots.set(wallTick + 2, snapshot);
    const delivered = delayedSnapshots.get(wallTick);
    if (delivered) applySnapshot(connection, delivered);
    delayedSnapshots.delete(wallTick);
  }
  delayedSnapshots.clear();
  for (let drainTick = 0; drainTick < 6; drainTick++) {
    const snapshot = stepDelayedServer(sim, playerId, delayedInputs);
    if (snapshot) applySnapshot(connection, snapshot);
  }
}

describe("prediction integration", () => {
  it("re-anchors movement after a late-session teleport instead of unwinding to spawn", () => {
    const sim = makeSim(716, { freezeEnemies: true });
    for (let tick = 0; tick < 100; tick++) sim.step();
    const joined = sim.addPlayer("Teleported", "teleported-client");
    const serverPlayer = sim.getPlayerEntity(joined.playerId);
    if (!serverPlayer) throw new Error("expected joined server player");
    const arena = findFlatArena(sim, joined.spawn.x, joined.spawn.y);
    teleport(serverPlayer, arena.x, arena.y, sim);
    const connection = new Connection("ws://integration.test", "Teleported", "teleported-client");
    connection.status = "connected";
    connection.world = new World(sim.world.worldSeed, sim.world.floor, LEVEL.Sandbox);

    const initial = sim.step().get(joined.playerId);
    if (!initial) throw new Error("expected initial authoritative snapshot");
    applySnapshot(connection, {
      ...initial,
      events: [...initial.events, { t: "teleported" }],
    });

    vi.spyOn(connection, "send").mockImplementation((message: ClientMessage) => {
      if (message.type === "input") sim.handleInput(joined.playerId, message);
    });
    connection.sendInputEdge(HELD_MOVE);
    for (let tick = 0; tick < 10; tick++) {
      connection.sampleInput(HELD_MOVE);
      const snapshot = sim.step().get(joined.playerId);
      if (snapshot) applySnapshot(connection, snapshot);
    }
    connection.sendInputEdge(IDLE);
    for (let tick = 0; tick < 70; tick++) {
      connection.sampleInput(IDLE);
      const snapshot = sim.step().get(joined.playerId);
      if (snapshot) applySnapshot(connection, snapshot);
    }

    expect(serverPlayer.body.x).toBeGreaterThan(arena.x + 1);
    expectSamePosition(connection, serverPlayer.body.x, serverPlayer.body.y);
    expect(connection.prediction.pendingStepCount).toBeLessThanOrEqual(1);
  });

  it("keeps 1,000 held ticks aligned with monotonic full-rate input", () => {
    const sim = makeSim(717, { freezeEnemies: true });
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
    connection.sendInputEdge(IDLE);
    connection.sampleInput(IDLE);
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

  it("settles at the authoritative endpoint after delayed walking and release", () => {
    const sim = makeSim(718, { freezeEnemies: true });
    const joined = sim.addPlayer("Delayed", "delayed-client");
    const serverPlayer = sim.getPlayerEntity(joined.playerId);
    if (!serverPlayer) throw new Error("expected joined server player");
    const arena = findFlatArena(sim, joined.spawn.x, joined.spawn.y);
    teleport(serverPlayer, arena.x, arena.y, sim);
    const connection = new Connection("ws://integration.test", "Delayed", "delayed-client");
    connection.status = "connected";
    connection.world = new World(sim.world.worldSeed, sim.world.floor, LEVEL.Sandbox);
    const initial = sim.step().get(joined.playerId);
    if (!initial) throw new Error("expected initial authoritative snapshot");
    applySnapshot(connection, initial);

    const delayedInputs = new Map<number, ClientInput[]>();
    const delayedSnapshots = new Map<number, ServerSnapshot>();
    vi.spyOn(connection, "send").mockImplementation((message: ClientMessage) => {
      if (message.type !== "input") return;
      const deliveryTick = sim.tick + 2;
      const queued = delayedInputs.get(deliveryTick) ?? [];
      queued.push(message);
      delayedInputs.set(deliveryTick, queued);
    });
    connection.sendInputEdge(HELD_MOVE);
    runDelayedMovement(sim, joined.playerId, connection, delayedInputs, delayedSnapshots);

    expect(serverPlayer.body.x).toBeGreaterThan(arena.x + 1);
    expectSamePosition(connection, serverPlayer.body.x, serverPlayer.body.y);
    expect(connection.prediction.pendingStepCount).toBeLessThanOrEqual(4);
  });
});
