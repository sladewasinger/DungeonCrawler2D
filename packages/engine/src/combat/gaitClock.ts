/** Shared distance-driven stride phase and footstep contact trigger for walk and sprint sync. */

export const WALK_CYCLE_TILES = 2.2;
export const RUN_CYCLE_TILES = 3.1;
const INITIAL_GAIT_PHASE = 0.08;
const TELEPORT_RESET_TILES = 1.5;

export interface GaitClock {
  prevX: number;
  prevY: number;
  phase: number;
  initialized: boolean;
}

export interface GaitStepInput {
  readonly x: number;
  readonly y: number;
  readonly moving: boolean;
  readonly sprinting: boolean;
  readonly airborne: boolean;
}

export interface GaitStepResult {
  readonly phase: number;
  readonly stepTriggered: boolean;
}

export function createGaitClock(): GaitClock {
  return { prevX: 0, prevY: 0, phase: INITIAL_GAIT_PHASE, initialized: false };
}

export function advanceGaitClock(clock: GaitClock, input: GaitStepInput): GaitStepResult {
  if (!clock.initialized) {
    clock.prevX = input.x;
    clock.prevY = input.y;
    clock.phase = INITIAL_GAIT_PHASE;
    clock.initialized = true;
    return { phase: clock.phase, stepTriggered: false };
  }
  const rawDist = Math.hypot(input.x - clock.prevX, input.y - clock.prevY);
  clock.prevX = input.x;
  clock.prevY = input.y;
  if (!input.moving || input.airborne) {
    clock.phase = INITIAL_GAIT_PHASE;
    return { phase: clock.phase, stepTriggered: false };
  }
  const dist = rawDist > TELEPORT_RESET_TILES ? 0 : rawDist;
  const cycleTiles = input.sprinting ? RUN_CYCLE_TILES : WALK_CYCLE_TILES;
  const prev = clock.phase;
  const next = prev + dist / cycleTiles;
  clock.phase = next;
  const stepTriggered = Math.floor(next * 2 + 0.5) > Math.floor(prev * 2 + 0.5);
  return { phase: next, stepTriggered };
}

export function gaitFrameIndex(phase: number, frameCount: number): number {
  if (frameCount <= 1) return 0;
  const frac = ((phase % 1) + 1) % 1;
  return Math.floor(frac * frameCount) % frameCount;
}
