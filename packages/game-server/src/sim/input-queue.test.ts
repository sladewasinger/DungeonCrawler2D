import {
  MOVE_SPEED,
  PROJECTED_INPUT_MAX_FUTURE_TICKS,
  PROJECTED_INPUT_MAX_PAST_TICKS,
  TICK_RATE,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { input, makeSim, teleport } from "./integration/support.js";

function nextSnapshot(sim: ReturnType<typeof makeSim>, playerId: string) {
  const snapshot = sim.step().get(playerId);
  if (!snapshot) throw new Error("player snapshot is missing");
  return snapshot;
}

/** Verifies that server movement replays client-tick control states at simulation cadence. */
describe("player input queue", () => {
  it("holds the newest direction until a newer neutral state arrives", () => {
    const sim = makeSim();
    const player = sim.addPlayer("Queue tester", "queue-client");
    const entity = sim.getPlayerEntity(player.playerId);
    if (!entity) throw new Error("joined player is missing");
    const start = { x: 5.5, y: 5.5 };
    teleport(entity, start.x, start.y, sim);

    sim.handleInput(player.playerId, input(1, 1, 0));
    sim.handleInput(player.playerId, input(2, 1, 0));

    const first = sim.step().get(player.playerId);
    if (!first) throw new Error("first snapshot is missing");
    expect(first.lastSeq).toBe(2);
    expect(first.lastProjectedServerTick).toBe(0);
    expect(entity.body.x - start.x).toBeCloseTo(MOVE_SPEED / TICK_RATE, 5);

    sim.step();
    expect(entity.body.x - start.x).toBeCloseTo((MOVE_SPEED / TICK_RATE) * 2, 5);

    sim.handleInput(player.playerId, input(3, 0, 0));
    const stopped = sim.step().get(player.playerId);
    if (!stopped) throw new Error("stopped snapshot is missing");
    expect(stopped.lastSeq).toBe(3);
    expect(entity.body.x - start.x).toBeCloseTo((MOVE_SPEED / TICK_RATE) * 2, 5);
  });

  it("advances the simulated input cursor while holding the latest control state", () => {
    const sim = makeSim();
    const player = sim.addPlayer("Ack tester", "ack-client");

    sim.handleInput(player.playerId, input(1, 1, 0, false, false, 7));
    expect(sim.step().get(player.playerId)?.lastProjectedServerTick).toBe(7);

    expect(sim.step().get(player.playerId)?.lastProjectedServerTick).toBe(8);
  });

  it("does not let a future stop erase movement ticks already predicted by the client", () => {
    const sim = makeSim();
    for (let tick = 0; tick < 100; tick++) sim.step();
    const player = sim.addPlayer("Burst tester", "burst-client");
    const entity = sim.getPlayerEntity(player.playerId);
    if (!entity) throw new Error("joined player is missing");
    const start = { x: 5.5, y: 5.5 };
    teleport(entity, start.x, start.y, sim);

    sim.handleInput(player.playerId, input(10, 1, 0, false, false, 101));
    sim.handleInput(player.playerId, input(11, 1, 0, false, false, 102));
    sim.handleInput(player.playerId, input(12, 0, 0, false, false, 103));

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
    const player = sim.addPlayer("Reversal tester", "reversal-client");
    const entity = sim.getPlayerEntity(player.playerId);
    if (!entity) throw new Error("joined player is missing");
    const start = { x: 5.5, y: 5.5 };
    teleport(entity, start.x, start.y, sim);

    sim.handleInput(player.playerId, input(1, 1, 0, false, false, 1));
    sim.handleInput(player.playerId, input(2, -1, 0, false, false, 2));
    sim.handleInput(player.playerId, input(3, 0, 0, false, false, 3));
    sim.step();
    sim.step();
    const snapshot = nextSnapshot(sim, player.playerId);

    expect(snapshot).toMatchObject({ lastSeq: 3, lastProjectedServerTick: 3 });
    expect(entity.body.x).toBeCloseTo(start.x, 5);
  });

  it("uses an explicit look vector without changing movement", () => {
    const sim = makeSim();
    const player = sim.addPlayer("Look tester", "look-client");
    const entity = sim.getPlayerEntity(player.playerId);
    if (!entity) throw new Error("joined player is missing");

    sim.handleInput(player.playerId, { type: "input", seq: 1, projectedServerTick: sim.tick, moveX: 1, moveY: 0, faceX: 0, faceY: -1, jump: false, run: false });
    sim.step();

    expect(entity.facing).toEqual({ x: 0, y: -1 });
  });

  it("keeps the highest accepted sequence when packets reorder before a step", () => {
    const sim = makeSim();
    const player = sim.addPlayer("Reorder tester", "reorder-client");
    const entity = sim.getPlayerEntity(player.playerId);
    if (!entity) throw new Error("joined player is missing");
    teleport(entity, 5.5, 5.5, sim);

    sim.handleInput(player.playerId, input(10, 1, 0, false, false, sim.tick));
    sim.handleInput(player.playerId, input(9, -1, 0, false, false, sim.tick));
    const snapshot = nextSnapshot(sim, player.playerId);

    expect(snapshot.lastSeq).toBe(10);
    expect(entity.body.x).toBeGreaterThan(5.5);
  });

  it("accepts bounded drift, rebases future clock lead, and rejects impossible past ticks", () => {
    const sim = makeSim();
    const player = sim.addPlayer("Timeline tester", "timeline-client");

    sim.handleInput(player.playerId, input(
      1,
      1,
      0,
      false,
      false,
      sim.tick + PROJECTED_INPUT_MAX_FUTURE_TICKS,
    ));
    expect(sim.step().get(player.playerId)).toMatchObject({
      lastSeq: 1,
      lastProjectedServerTick: PROJECTED_INPUT_MAX_FUTURE_TICKS,
    });

    let timelineSnapshot = nextSnapshot(sim, player.playerId);
    for (let tick = 1; tick <= PROJECTED_INPUT_MAX_PAST_TICKS; tick++) {
      timelineSnapshot = nextSnapshot(sim, player.playerId);
    }
    const timelineTick = timelineSnapshot.lastProjectedServerTick;
    sim.handleInput(player.playerId, input(
      2,
      0,
      0,
      false,
      false,
      timelineTick - PROJECTED_INPUT_MAX_PAST_TICKS,
    ));
    const accepted = nextSnapshot(sim, player.playerId);
    expect(accepted.lastSeq).toBe(2);

    const futureTick =
      accepted.lastProjectedServerTick + PROJECTED_INPUT_MAX_FUTURE_TICKS + 1;
    sim.handleInput(
      player.playerId,
      input(3, -1, 0, false, false, futureTick),
    );
    expect(sim.step().get(player.playerId)).toMatchObject({
      lastSeq: 3,
      lastProjectedServerTick: futureTick,
    });

    sim.handleInput(
      player.playerId,
      input(
        4,
        -1,
        0,
        false,
        false,
        futureTick - PROJECTED_INPUT_MAX_PAST_TICKS - 1,
      ),
    );
    expect(sim.step().get(player.playerId)?.lastSeq).toBe(3);
  });

  it("recovers the 33-tick client lead captured by the movement trace", () => {
    const sim = makeSim();
    const player = sim.addPlayer("Trace tester", "trace-client");
    const entity = sim.getPlayerEntity(player.playerId);
    if (!entity) throw new Error("joined player is missing");
    const start = { x: 5.5, y: 5.5 };
    teleport(entity, start.x, start.y, sim);

    sim.handleInput(
      player.playerId,
      input(47, 0, 0, false, false, 625),
    );
    expect(sim.step().get(player.playerId)).toMatchObject({
      lastSeq: 47,
      lastProjectedServerTick: 625,
    });

    sim.handleInput(
      player.playerId,
      input(206, 1, 0, false, false, 658),
    );
    expect(sim.step().get(player.playerId)).toMatchObject({
      lastSeq: 206,
      lastProjectedServerTick: 658,
    });
    expect(entity.body.x).toBeGreaterThan(start.x);
  });
});
