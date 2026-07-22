import { MOVE_SPEED, TICK_RATE } from "@dc2d/engine";
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

    sim.handleInput(player.playerId, { type: "input", seq: 1, moveX: 1, moveY: 0, faceX: 0, faceY: -1, jump: false, run: false });
    sim.step();

    expect(entity.facing).toEqual({ x: 0, y: -1 });
  });
});
