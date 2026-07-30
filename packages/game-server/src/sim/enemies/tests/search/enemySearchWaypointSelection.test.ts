import { describe, expect, it } from "vitest";
import type {
  EnemySearchPoint,
  EnemySearchState,
} from "../../../state/enemyState.js";
import {
  advanceEnemySearchState,
  createEnemySearchState,
} from "../../ai/search/enemySearchStateMachine.js";

const ANCHOR = { x: 0.5, y: 0.5, z: 0 };

interface AdvanceFixture {
  readonly state: EnemySearchState;
  readonly candidates: ReadonlyArray<{ readonly x: number; readonly y: number }>;
  readonly position?: EnemySearchPoint;
  readonly pauseTicks?: number;
  readonly isReachable?: (point: EnemySearchPoint) => boolean;
}

describe("enemy search waypoint selection", () => {
  it("selects the next waypoint on the same zero-pause arrival update", () => {
    const candidates = [{ x: 1.5, y: 0.5 }, { x: 2.5, y: 0.5 }];
    const first = advance({
      state: createEnemySearchState(ANCHOR, 0),
      candidates,
    });
    const arrival = advance({
      state: first.state,
      position: first.target ?? ANCHOR,
      candidates,
    });

    expect(arrival.selectedWaypoint).toBe(true);
    expect(arrival.target).toEqual({ x: 2.5, y: 0.5, z: 0 });
    expect(arrival.state.pauseTicksRemaining).toBe(0);
  });

  it("keeps the configured pause after a nonzero-pause arrival", () => {
    const candidates = [{ x: 1.5, y: 0.5 }];
    const first = advance({
      state: createEnemySearchState(ANCHOR, 0),
      candidates,
      pauseTicks: 2,
    });
    const arrival = advance({
      state: first.state,
      position: first.target ?? ANCHOR,
      candidates,
      pauseTicks: 2,
    });

    expect(arrival.selectedWaypoint).toBe(false);
    expect(arrival.target).toBeUndefined();
    expect(arrival.state.pauseTicksRemaining).toBe(2);
  });

  it("skips several unreachable candidates within one update", () => {
    const candidates = Array.from({ length: 4 }, (_, index) => ({
      x: index + 1.5,
      y: 0.5,
    }));
    let checks = 0;
    const result = advance({
      state: createEnemySearchState(ANCHOR, 0),
      candidates,
      isReachable: (point) => {
        checks++;
        return point.x === 4.5;
      },
    });

    expect(result.target).toEqual({ x: 4.5, y: 0.5, z: 0 });
    expect(checks).toBe(4);
    expect(result.state.candidateCursor).toBe(4);
  });

  it("bounds each update when every candidate is unreachable", () => {
    const candidates = Array.from({ length: 12 }, (_, index) => ({
      x: index + 1.5,
      y: 0.5,
    }));
    let checks = 0;
    const result = advance({
      state: createEnemySearchState(ANCHOR, 0),
      candidates,
      isReachable: () => {
        checks++;
        return false;
      },
    });

    expect(result.selectedWaypoint).toBe(false);
    expect(checks).toBe(8);
    expect(result.state.candidateCursor).toBe(8);
  });
});

function advance(fixture: AdvanceFixture) {
  return advanceEnemySearchState({
    state: fixture.state,
    position: fixture.position ?? ANCHOR,
    candidates: fixture.candidates,
    arrivalTolerance: 0.1,
    waypointPauseTicks: fixture.pauseTicks ?? 0,
    groundAt: () => 0,
    isReachable: fixture.isReachable ?? (() => true),
  });
}
