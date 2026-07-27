import {
  PROJECTED_INPUT_MAX_FUTURE_TICKS,
  PROJECTED_INPUT_MAX_PAST_TICKS,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { findFlatArena, input, makeSim, teleport } from "../integration/support.js";

describe("player input queue timeline", () => {
  it("accepts bounded drift, rebases future clock lead, and rejects impossible past ticks", () => {
    const sim = makeSim();
    const player = sim.addPlayer({ name: "Timeline tester", clientId: "timeline-client" });
    sim.handleInput(player.playerId, input({
      seq: 1,
      moveX: 1,
      moveY: 0,
      projectedServerTick: sim.tick + PROJECTED_INPUT_MAX_FUTURE_TICKS,
    }));
    expect(nextSnapshot(sim, player.playerId)).toMatchObject({
      lastSeq: 1,
      lastProjectedServerTick: PROJECTED_INPUT_MAX_FUTURE_TICKS,
    });

    let snapshot = nextSnapshot(sim, player.playerId);
    for (let tick = 1; tick <= PROJECTED_INPUT_MAX_PAST_TICKS; tick++) {
      snapshot = nextSnapshot(sim, player.playerId);
    }
    const accepted = acceptNeutralInput(sim, player.playerId, snapshot.lastProjectedServerTick);
    expect(accepted.lastSeq).toBe(2);

    const futureTick = accepted.lastProjectedServerTick + PROJECTED_INPUT_MAX_FUTURE_TICKS + 1;
    sim.handleInput(player.playerId, input({ seq: 3, moveX: -1, moveY: 0, projectedServerTick: futureTick }));
    expect(nextSnapshot(sim, player.playerId)).toMatchObject({ lastSeq: 3, lastProjectedServerTick: futureTick });

    sim.handleInput(player.playerId, input({
      seq: 4,
      moveX: -1,
      moveY: 0,
      projectedServerTick: futureTick - PROJECTED_INPUT_MAX_PAST_TICKS - 1,
    }));
    expect(nextSnapshot(sim, player.playerId)?.lastSeq).toBe(3);
  });

  it("recovers the 33-tick client lead captured by the movement trace", () => {
    const sim = makeSim();
    const player = sim.addPlayer({ name: "Trace tester", clientId: "trace-client" });
    const entity = sim.getPlayerEntity(player.playerId)!;
    const start = findFlatArena({ sim, anchor: { x: 5.5, y: 5.5 } });
    teleport({ entity, x: start.x, y: start.y, sim });
    expectProjectedInput({ sim, playerId: player.playerId, sequence: 47, moveX: 0, tick: 625 });
    expectProjectedInput({ sim, playerId: player.playerId, sequence: 206, moveX: 1, tick: 658 });
    expect(entity.body.x).toBeGreaterThan(start.x);
  });
});

function nextSnapshot(sim: ReturnType<typeof makeSim>, playerId: string) {
  const snapshot = sim.step().get(playerId);
  if (!snapshot) throw new Error("player snapshot is missing");
  return snapshot;
}

function acceptNeutralInput(sim: ReturnType<typeof makeSim>, playerId: string, tick: number) {
  sim.handleInput(playerId, input({
    seq: 2,
    moveX: 0,
    moveY: 0,
    projectedServerTick: tick - PROJECTED_INPUT_MAX_PAST_TICKS,
  }));
  return nextSnapshot(sim, playerId);
}

interface ProjectedInputExpectation {
  sim: ReturnType<typeof makeSim>;
  playerId: string;
  sequence: number;
  moveX: -1 | 0 | 1;
  tick: number;
}

function expectProjectedInput({ sim, playerId, sequence, moveX, tick }: ProjectedInputExpectation): void {
  sim.handleInput(playerId, input({ seq: sequence, moveX, moveY: 0, projectedServerTick: tick }));
  expect(nextSnapshot(sim, playerId)).toMatchObject({ lastSeq: sequence, lastProjectedServerTick: tick });
}
