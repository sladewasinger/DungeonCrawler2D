import {
  TICK_DT,
  activeEnemyMemory,
  ageEnemyMemory,
  beginEnemySearch,
  newBrain,
  type MoveInput,
} from "@dc2d/engine";
import type { EnemySearchState } from "../../state/enemyState.js";
import { enemySearchCandidates } from "../ai/search/enemySearchCandidates.js";
import {
  advanceEnemySearchState,
  createEnemySearchState,
  searchPointKey,
} from "../ai/search/enemySearchStateMachine.js";
import { enemySearchMove } from "../ai/search/enemySearchSteering.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";

const ANCHOR = { x: 0.5, y: 0.5, z: 0 };
const SPEED = 3;
const ARRIVAL_TOLERANCE = SPEED * TICK_DT + 0.1;
const SEARCH = ENEMY_SIMULATION_TUNING.perception;

export interface EnemySearchTick {
  readonly move: MoveInput;
  readonly targetKey: string | undefined;
  readonly secondsRemaining: number;
}

export interface EnemySearchSequence {
  readonly ticks: EnemySearchTick[];
  readonly selectedWaypointKeys: string[];
  readonly state: EnemySearchState;
  readonly forgotTarget: boolean;
}

interface FlatSearchRun {
  readonly brain: ReturnType<typeof newBrain>;
  readonly position: { x: number; y: number };
  readonly candidates: ReturnType<typeof enemySearchCandidates>;
  readonly ticks: EnemySearchTick[];
  readonly selectedWaypointKeys: string[];
  state: EnemySearchState;
}

export function runFlatEnemySearch(): EnemySearchSequence {
  const run = createFlatSearchRun();
  for (let tick = 0; tick < 500 && activeEnemyMemory(run.brain); tick++) {
    stepFlatEnemySearch(run);
  }
  return {
    ticks: run.ticks,
    selectedWaypointKeys: run.selectedWaypointKeys,
    state: run.state,
    forgotTarget: run.brain.rememberedTarget === null,
  };
}

function createFlatSearchRun(): FlatSearchRun {
  const brain = newBrain();
  brain.rememberedTarget = { targetId: "hidden-player", ...ANCHOR };
  brain.memorySecondsRemaining = SEARCH.memorySeconds;
  beginEnemySearch(brain, SEARCH.memorySearchSeconds);
  return {
    brain,
    state: createEnemySearchState(
      ANCHOR,
      SEARCH.memorySearchWaypointPauseTicks,
    ),
    position: { x: ANCHOR.x, y: ANCHOR.y },
    candidates: enemySearchCandidates({
      anchor: ANCHOR,
      radius: SEARCH.memorySearchRadiusTiles,
      seed: 17,
    }),
    ticks: [],
    selectedWaypointKeys: [],
  };
}

function stepFlatEnemySearch(run: FlatSearchRun): void {
  ageEnemyMemory(run.brain, TICK_DT);
  if (!activeEnemyMemory(run.brain)) return;
  const advance = advanceEnemySearchState({
    state: run.state,
    position: run.position,
    candidates: run.candidates,
    arrivalTolerance: ARRIVAL_TOLERANCE,
    waypointPauseTicks: SEARCH.memorySearchWaypointPauseTicks,
    groundAt: () => 0,
    isReachable: () => true,
  });
  run.state = advance.state;
  if (advance.selectedWaypoint && advance.target) {
    run.selectedWaypointKeys.push(searchPointKey(advance.target));
  }
  const move = advance.target
    ? enemySearchMove({
      position: run.position,
      target: advance.target,
      arrivalTolerance: ARRIVAL_TOLERANCE,
    })
    : { moveX: 0, moveY: 0, jump: false };
  run.position.x += move.moveX * SPEED * TICK_DT;
  run.position.y += move.moveY * SPEED * TICK_DT;
  run.ticks.push({
    move,
    targetKey: advance.target && searchPointKey(advance.target),
    secondsRemaining: run.brain.memorySearchSecondsRemaining ?? 0,
  });
}

export function hasSameTargetOscillation(
  ticks: readonly EnemySearchTick[],
): boolean {
  return ticks.some((tick, index) => {
    const previous = ticks[index - 1];
    if (!previous || !tick.targetKey ||
        tick.targetKey !== previous.targetKey) return false;
    return reversed(tick.move.moveX, previous.move.moveX) ||
      reversed(tick.move.moveY, previous.move.moveY);
  });
}

export function searchTargetsStayBounded(
  ticks: readonly EnemySearchTick[],
  radius: number,
): boolean {
  return ticks.every(({ targetKey }) => {
    if (!targetKey) return true;
    const [x = 0, y = 0] = targetKey.split(",").map(Number);
    return Math.hypot(x + 0.5 - ANCHOR.x, y + 0.5 - ANCHOR.y) <= radius;
  });
}

function reversed(current: number, previous: number): boolean {
  return current !== 0 && previous !== 0 && current * previous < 0;
}
