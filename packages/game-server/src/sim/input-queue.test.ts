import {
  MOVE_SPEED,
  TICK_RATE,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { findFlatArena, input, makeSim, teleport } from "./integration/support.js";

const JOINED_PLAYER_MISSING = "joined player is missing";

function nextSnapshot(sim: ReturnType<typeof makeSim>, playerId: string) {
  const snapshot = sim.step().get(playerId);
  if (!snapshot) throw new Error("player snapshot is missing");
  return snapshot;
}

/** Verifies that server movement replays client-tick control states at simulation cadence. */
describe("player input queue", () => {
  it("holds the newest direction until a newer neutral state arrives", () => {
    const sim = makeSim();
    const player = sim.addPlayer({ name: "Queue tester", clientId: "queue-client" });
    const entity = sim.getPlayerEntity(player.playerId);
    if (!entity) throw new Error(JOINED_PLAYER_MISSING);
    const start = findFlatArena({ sim: sim, anchor: { x: 5.5, y: 5.5 } });
    teleport({ entity: entity, x: start.x, y: start.y, sim: sim });

    sim.handleInput(player.playerId, input({ seq: 1, moveX: 1, moveY: 0 }));
    sim.handleInput(player.playerId, input({ seq: 2, moveX: 1, moveY: 0 }));

    const first = sim.step().get(player.playerId);
    if (!first) throw new Error("first snapshot is missing");
    expect(first.lastSeq).toBe(2);
    expect(first.lastProjectedServerTick).toBe(0);
    expect(entity.body.x - start.x).toBeCloseTo(MOVE_SPEED / TICK_RATE, 5);

    sim.step();
    expect(entity.body.x - start.x).toBeCloseTo((MOVE_SPEED / TICK_RATE) * 2, 5);

    sim.handleInput(player.playerId, input({ seq: 3, moveX: 0, moveY: 0 }));
    const stopped = sim.step().get(player.playerId);
    if (!stopped) throw new Error("stopped snapshot is missing");
    expect(stopped.lastSeq).toBe(3);
    expect(entity.body.x - start.x).toBeCloseTo((MOVE_SPEED / TICK_RATE) * 2, 5);
  });

  it("advances the simulated input cursor while holding the latest control state", () => {
    const sim = makeSim();
    const player = sim.addPlayer({ name: "Ack tester", clientId: "ack-client" });

    sim.handleInput(player.playerId, input({ seq: 1, moveX: 1, moveY: 0, jump: false, run: false, projectedServerTick: 7 }));
    expect(sim.step().get(player.playerId)?.lastProjectedServerTick).toBe(7);

    expect(sim.step().get(player.playerId)?.lastProjectedServerTick).toBe(8);
  });

  it("does not let a future stop erase movement ticks already predicted by the client", () => {
    const sim = makeSim();
    for (let tick = 0; tick < 100; tick++) sim.step();
    const player = sim.addPlayer({ name: "Burst tester", clientId: "burst-client" });
    const entity = sim.getPlayerEntity(player.playerId);
    if (!entity) throw new Error(JOINED_PLAYER_MISSING);
    const start = findFlatArena({ sim: sim, anchor: { x: 5.5, y: 5.5 } });
    teleport({ entity: entity, x: start.x, y: start.y, sim: sim });

    sim.handleInput(player.playerId, input({ seq: 10, moveX: 1, moveY: 0, jump: false, run: false, projectedServerTick: 101 }));
    sim.handleInput(player.playerId, input({ seq: 11, moveX: 1, moveY: 0, jump: false, run: false, projectedServerTick: 102 }));
    sim.handleInput(player.playerId, input({ seq: 12, moveX: 0, moveY: 0, jump: false, run: false, projectedServerTick: 103 }));

    expect(sim.step().get(player.playerId)).toMatchObject({
      lastSeq: 10,
      lastProjectedServerTick: 101,
    });
    expect(entity.body.x - start.x).toBeCloseTo(MOVE_SPEED / TICK_RATE, 5);

    expect(sim.step().get(player.playerId)).toMatchObject({
      lastSeq: 11,
      lastProjectedServerTick: 102,
    });
    expect(entity.body.x - start.x).toBeCloseTo((MOVE_SPEED / TICK_RATE) * 2, 5);

    expect(sim.step().get(player.playerId)).toMatchObject({
      lastSeq: 12,
      lastProjectedServerTick: 103,
    });
    expect(entity.body.x - start.x).toBeCloseTo((MOVE_SPEED / TICK_RATE) * 2, 5);
  });

  it("replays rapid reversals in tick order and reaches the predicted endpoint", () => {
    const sim = makeSim();
    const player = sim.addPlayer({ name: "Reversal tester", clientId: "reversal-client" });
    const entity = sim.getPlayerEntity(player.playerId);
    if (!entity) throw new Error(JOINED_PLAYER_MISSING);
    const start = findFlatArena({ sim: sim, anchor: { x: 5.5, y: 5.5 } });
    teleport({ entity: entity, x: start.x, y: start.y, sim: sim });

    sim.handleInput(player.playerId, input({ seq: 1, moveX: 1, moveY: 0, jump: false, run: false, projectedServerTick: 1 }));
    sim.handleInput(player.playerId, input({ seq: 2, moveX: -1, moveY: 0, jump: false, run: false, projectedServerTick: 2 }));
    sim.handleInput(player.playerId, input({ seq: 3, moveX: 0, moveY: 0, jump: false, run: false, projectedServerTick: 3 }));
    sim.step();
    sim.step();
    const snapshot = nextSnapshot(sim, player.playerId);

    expect(snapshot).toMatchObject({ lastSeq: 3, lastProjectedServerTick: 3 });
    expect(entity.body.x).toBeCloseTo(start.x, 5);
  });

  it("uses an explicit look vector without changing movement", () => {
    const sim = makeSim();
    const player = sim.addPlayer({ name: "Look tester", clientId: "look-client" });
    const entity = sim.getPlayerEntity(player.playerId);
    if (!entity) throw new Error(JOINED_PLAYER_MISSING);

    sim.handleInput(player.playerId, { type: "input", seq: 1, projectedServerTick: sim.tick, moveX: 1, moveY: 0, faceX: 0, faceY: -1, jump: false, run: false });
    sim.step();

    expect(entity.facing).toEqual({ x: 0, y: -1 });
  });

  it("keeps the highest accepted sequence when packets reorder before a step", () => {
    const sim = makeSim();
    const player = sim.addPlayer({ name: "Reorder tester", clientId: "reorder-client" });
    const entity = sim.getPlayerEntity(player.playerId);
    if (!entity) throw new Error("joined player is missing");
    const start = findFlatArena({ sim: sim, anchor: { x: 5.5, y: 5.5 } });
    teleport({ entity: entity, x: start.x, y: start.y, sim: sim });

    sim.handleInput(player.playerId, input({ seq: 10, moveX: 1, moveY: 0, jump: false, run: false, projectedServerTick: sim.tick }));
    sim.handleInput(player.playerId, input({ seq: 9, moveX: -1, moveY: 0, jump: false, run: false, projectedServerTick: sim.tick }));
    const snapshot = nextSnapshot(sim, player.playerId);

    expect(snapshot.lastSeq).toBe(10);
    expect(entity.body.x).toBeGreaterThan(start.x);
  });

});
