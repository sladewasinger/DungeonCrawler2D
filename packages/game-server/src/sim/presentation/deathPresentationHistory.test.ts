import { describe, expect, it } from "vitest";
import {
  DEATH_PRESENTATION_HISTORY_CAP,
  DEATH_PRESENTATION_TTL_TICKS,
  pruneDeathPresentationHistory,
} from "./deathPresentationHistory.js";

describe("death presentation history", () => {
  it("keeps a bounded active window and expires old deaths", () => {
    const history = Array.from(
      { length: DEATH_PRESENTATION_HISTORY_CAP + 2 },
      (_, index) => death(index + 1),
    );
    const sim = {
      tickCount: DEATH_PRESENTATION_HISTORY_CAP + 2,
      deathPresentationHistory: history,
    };
    pruneDeathPresentationHistory(sim as never);
    expect(sim.deathPresentationHistory).toHaveLength(DEATH_PRESENTATION_HISTORY_CAP);
    expect(sim.deathPresentationHistory[0]?.occurredAtTick).toBe(3);
    sim.tickCount += DEATH_PRESENTATION_TTL_TICKS;
    pruneDeathPresentationHistory(sim as never);
    expect(sim.deathPresentationHistory).toEqual([]);
  });
});

function death(occurredAtTick: number) {
  return {
    id: `enemy-${occurredAtTick}`,
    occurredAtTick,
    x: 0,
    y: 0,
    defId: "slime",
    targetKind: "enemy" as const,
  };
}
