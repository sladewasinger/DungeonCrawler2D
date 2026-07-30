import { describe, expect, it } from "vitest";
import { enemySearchCandidates } from "../ai/search/enemySearchCandidates.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";
import { runFlatEnemySearch } from "./enemySearchSequenceTestSupport.js";

const ANCHOR = { x: 0.5, y: 0.5 };

describe("enemy search forward bias", () => {
  it("starts forward and covers the wider configured search envelope", () => {
    const radius = ENEMY_SIMULATION_TUNING.perception.memorySearchRadiusTiles;
    const candidates = enemySearchCandidates({
      anchor: ANCHOR,
      radius,
      seed: 17,
      forward: { x: 1, y: 0 },
      forwardDistance:
        ENEMY_SIMULATION_TUNING.perception.memorySearchForwardDistanceTiles,
    });
    const furthest = Math.max(...candidates.map((candidate) =>
      Math.hypot(candidate.x - ANCHOR.x, candidate.y - ANCHOR.y)));

    expect(candidates[0]).toEqual({ x: 3.5, y: 0.5 });
    expect(furthest).toBe(radius);
  });

  it("visits forward-biased waypoints without repeating a tiny loop", () => {
    const sequence = runFlatEnemySearch({ forward: { x: 1, y: 0 } });

    expect(sequence.selectedWaypointKeys[0]).toBe("3,0");
    expect(new Set(sequence.selectedWaypointKeys).size)
      .toBe(sequence.selectedWaypointKeys.length);
    expect(sequence.forgotTarget).toBe(true);
  });
});
