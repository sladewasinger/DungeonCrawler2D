import {
  TICK_DT,
  createBody,
  enemyThink,
  makeEntity,
  newBrain,
  type EnemyDef,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { EnemySlot, SimState } from "../../state/state.js";
import { withEnemySearch } from "../ai/search/enemySearch.js";
import { enemySearchCandidates } from "../ai/search/enemySearchCandidates.js";
import {
  advanceEnemySearchState,
  createEnemySearchState,
} from "../ai/search/enemySearchStateMachine.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";
import {
  hasSameTargetOscillation,
  runFlatEnemySearch,
  searchTargetsStayBounded,
} from "./enemySearchSequenceTestSupport.js";

const ENEMY_DEF: EnemyDef = {
  id: "search-fixture",
  name: "Search Fixture",
  tags: [],
  hp: 10,
  speed: 3,
  aggroRadius: 8,
  attack: { damage: 1, range: 0.5, cooldown: 1 },
  drops: [],
  sprite: "slime",
};

describe("enemy search state machine", () => {
  it("fans across distinct flat-ground points for one bounded memory window", () => {
    const sequence = runFlatEnemySearch();
    expect(sequence.selectedWaypointKeys.length).toBeGreaterThan(3);
    expect(new Set(sequence.selectedWaypointKeys).size)
      .toBe(sequence.selectedWaypointKeys.length);
    expect(hasSameTargetOscillation(sequence.ticks)).toBe(false);
    expect(searchTargetsStayBounded(
      sequence.ticks,
      ENEMY_SIMULATION_TUNING.perception.memorySearchRadiusTiles,
    )).toBe(true);
    expect(sequence.ticks.every(({ move }) => !move.jump)).toBe(true);
    expect(searchTimerOnlyDecreases(sequence.ticks)).toBe(true);
    expect(sequence.forgotTarget).toBe(true);
  });

  it("immediately clears search state when sight returns", () => {
    const enemyEntity = makeEntity(
      "enemy",
      createBody(0.5, 0.5, 0),
      { id: "searcher", hp: 10, maxHp: 10 },
    );
    const player = makeEntity(
      "player",
      createBody(2.5, 0.5, 0),
      { id: "visible-player", hp: 10, maxHp: 10 },
    );
    const brain = newBrain();
    brain.rememberedTarget = {
      targetId: player.id,
      x: 0.5,
      y: 0.5,
      z: 0,
    };
    brain.memoryPhase = "searching";
    brain.memorySearchSecondsRemaining = 12;
    const enemy = enemySlot(enemyEntity, brain);
    enemy.searchState = {
      anchor: { x: 0.5, y: 0.5, z: 0 },
      visitedWaypointKeys: ["0,0", "1,0"],
      candidateCursor: 3,
      pauseTicksRemaining: 0,
      waypoint: { x: 1.5, y: 0.5, z: 0 },
    };
    const decision = enemyThink({
      brain,
      enemy: enemyEntity,
      def: ENEMY_DEF,
      players: [player],
      inSanctuary: () => false,
      dt: TICK_DT,
      rng: () => 0.5,
      memorySeconds: 20,
    });
    const reacquired = withEnemySearch({
      sim: {} as SimState,
      enemy,
      visibleTarget: player,
      decision,
      arrivalTolerance: 0.3,
    });
    expect(reacquired.pursuit).toMatchObject({
      x: player.body.x,
      y: player.body.y,
      z: player.body.z,
    });
    expect(brain.memoryPhase).toBe("pursuing");
    expect(brain.memorySearchSecondsRemaining).toBe(0);
    expect(enemy.searchState).toBeNull();
  });

  it("scans in place when every nearby point is unreachable", () => {
    const anchor = { x: 0.5, y: 0.5, z: 0 };
    const candidates = enemySearchCandidates({
      anchor,
      radius: 2,
      seed: 4,
    });
    let state = createEnemySearchState(anchor, 0);
    const targets = [];
    for (let tick = 0; tick < candidates.length + 5; tick++) {
      const advance = advanceEnemySearchState({
        state,
        position: anchor,
        candidates,
        arrivalTolerance: 0.3,
        waypointPauseTicks: 2,
        groundAt: () => 0,
        isReachable: () => false,
      });
      state = advance.state;
      targets.push(advance.target);
    }
    expect(targets.every((target) => target === undefined)).toBe(true);
    expect(state.waypoint).toBeUndefined();
    expect(state.candidateCursor).toBe(candidates.length);
  });

});

function searchTimerOnlyDecreases(
  ticks: ReturnType<typeof runFlatEnemySearch>["ticks"],
): boolean {
  return ticks.every((tick, index) => {
    const previous = ticks[index - 1];
    return !previous || tick.secondsRemaining < previous.secondsRemaining;
  });
}

function enemySlot(
  entity: ReturnType<typeof makeEntity>,
  brain: ReturnType<typeof newBrain>,
): EnemySlot {
  return {
    entity,
    brain,
    def: ENEMY_DEF,
    animation: { state: "idle", ticksRemaining: 0 },
  };
}
