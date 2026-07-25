import {
  MOVE_SPEED,
  PROJECTED_INPUT_MAX_FUTURE_TICKS,
  PROJECTED_INPUT_MAX_PAST_TICKS,
  TICK_RATE,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { input, makeSim, teleport } from "./integration/support.js";

/** Verifies that server movement consumes the newest control state, never a packet backlog. */
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
    expect(first.lastProjectedServerTick).toBe(sim.tick);
    expect(entity.body.x - start.x).toBeCloseTo(MOVE_SPEED / TICK_RATE, 5);

    sim.step();
    expect(entity.body.x - start.x).toBeCloseTo((MOVE_SPEED / TICK_RATE) * 2, 5);

    sim.handleInput(player.playerId, input(3, 0, 0));
    const stopped = sim.step().get(player.playerId);
    if (!stopped) throw new Error("stopped snapshot is missing");
    expect(stopped.lastSeq).toBe(3);
    expect(entity.body.x - start.x).toBeCloseTo((MOVE_SPEED / TICK_RATE) * 2, 5);
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
    const entity = sim.getPlayerEntity(player.playerId)!;
    teleport(entity, 5.5, 5.5, sim);

    sim.handleInput(player.playerId, input(10, 1, 0, false, false, sim.tick));
    sim.handleInput(player.playerId, input(9, -1, 0, false, false, sim.tick));
    const snapshot = sim.step().get(player.playerId)!;

    expect(snapshot.lastSeq).toBe(10);
    expect(entity.body.x).toBeGreaterThan(5.5);
  });

  it("rejects projected ticks outside the bounded server window", () => {
    const sim = makeSim();
    const player = sim.addPlayer("Timeline tester", "timeline-client");

    sim.handleInput(player.playerId, input(
      1,
      1,
      0,
      false,
      false,
      sim.tick + PROJECTED_INPUT_MAX_FUTURE_TICKS + 1,
    ));
    expect(sim.step().get(player.playerId)?.lastSeq).toBe(-1);

    for (let index = 0; index <= PROJECTED_INPUT_MAX_PAST_TICKS; index++) sim.step();
    sim.handleInput(player.playerId, input(2, 1, 0, false, false, 0));
    expect(sim.step().get(player.playerId)?.lastSeq).toBe(-1);
  });
});
