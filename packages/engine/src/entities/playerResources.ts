import {
  BLOCK_STAMINA_PER_SECOND,
  IDLE_STAMINA_RECOVERY_PER_SECOND,
  SPRINT_STAMINA_PER_SECOND,
  STAMINA_EXHAUSTION_RECOVERY_DELAY_SECONDS,
  STAMINA_EXHAUSTION_RECOVERY_FRACTION,
  WALK_STAMINA_RECOVERY_PER_SECOND,
} from "../core/constants.js";
import type { MoveInput } from "./movement/state.js";

export interface PlayerResourceState {
  stamina: number;
  maxStamina: number;
  blocking: boolean;
  staminaRecoveryDelaySeconds?: number;
  staminaExhausted?: boolean;
}

export interface PlayerResourceStep {
  input: MoveInput;
  sprinting: boolean;
}

export interface PlayerResourceInput {
  state: PlayerResourceState;
  input: MoveInput;
  canBlock: boolean;
  dt: number;
}

export interface PlayerResourceStepIntoInput extends PlayerResourceInput {
  output: PlayerResourceStep;
}

interface StaminaUpdate {
  state: PlayerResourceState;
  moving: boolean;
  sprinting: boolean;
  dt: number;
}

const clampStamina = (state: PlayerResourceState, value: number): void => {
  state.stamina = Math.max(0, Math.min(state.maxStamina, value));
};

const drainStamina = (state: PlayerResourceState, amount: number): void => {
  const hadStamina = state.stamina > 0;
  clampStamina(state, state.stamina - amount);
  if (hadStamina && state.stamina === 0) {
    state.staminaRecoveryDelaySeconds =
      STAMINA_EXHAUSTION_RECOVERY_DELAY_SECONDS;
    state.staminaExhausted = true;
  }
};

const isMoving = (input: MoveInput): boolean =>
  input.moveX !== 0 || input.moveY !== 0;

const wantsBlock = ({ input, canBlock, stamina, exhausted }: {
  input: MoveInput;
  canBlock: boolean;
  stamina: number;
  exhausted: boolean;
}): boolean =>
  Boolean(input.block) && canBlock && stamina > 0 && !exhausted;

const wantsSprint = ({ input, moving, blocking, stamina, exhausted }: {
  input: MoveInput;
  moving: boolean;
  blocking: boolean;
  stamina: number;
  exhausted: boolean;
}): boolean =>
  Boolean(input.run) && moving && !blocking && stamina > 0 && !exhausted;

function updateStamina({ state, moving, sprinting, dt }: StaminaUpdate): void {
  state.staminaRecoveryDelaySeconds ??= 0;
  if (drainBlockingStamina(state, dt)) return;
  if (drainSprintStamina(state, sprinting, dt)) return;
  if (waitForExhaustionRecovery(state, dt)) return;
  recoverStamina(state, moving, dt);
}

function drainBlockingStamina(state: PlayerResourceState, dt: number): boolean {
  if (!state.blocking) return false;
  drainStamina(state, BLOCK_STAMINA_PER_SECOND * dt);
  if (state.stamina === 0) state.blocking = false;
  return true;
}

function drainSprintStamina(state: PlayerResourceState, sprinting: boolean, dt: number): boolean {
  if (!sprinting) return false;
  drainStamina(state, SPRINT_STAMINA_PER_SECOND * dt);
  return true;
}

function waitForExhaustionRecovery(state: PlayerResourceState, dt: number): boolean {
  const delay = state.staminaRecoveryDelaySeconds ?? 0;
  if (delay === 0) return false;
  state.staminaRecoveryDelaySeconds = Math.max(0, delay - dt);
  return true;
}

function recoverStamina(state: PlayerResourceState, moving: boolean, dt: number): void {
  const recovery = moving
    ? WALK_STAMINA_RECOVERY_PER_SECOND
    : IDLE_STAMINA_RECOVERY_PER_SECOND;
  clampStamina(state, state.stamina + recovery * dt);
  if (state.staminaExhausted && state.stamina >= state.maxStamina * STAMINA_EXHAUSTION_RECOVERY_FRACTION) {
    state.staminaExhausted = false;
  }
}

export function createPlayerResourceStep(): PlayerResourceStep {
  return {
    input: {
      moveX: 0,
      moveY: 0,
      faceX: undefined,
      faceY: undefined,
      jump: false,
      run: false,
      block: false,
    },
    sprinting: false,
  };
}

function copyEffectiveInput({ target, source, sprinting, blocking }: {
  target: MoveInput;
  source: MoveInput;
  sprinting: boolean;
  blocking: boolean;
}): void {
  target.moveX = source.moveX;
  target.moveY = source.moveY;
  target.faceX = source.faceX;
  target.faceY = source.faceY;
  target.jump = source.jump;
  target.run = sprinting;
  target.block = blocking;
}

/** Allocation-free resource step for fixed simulation and render projection hot paths. */
export function stepPlayerResourcesInto({ state, input, canBlock, dt, output }: PlayerResourceStepIntoInput): PlayerResourceStep {
  state.staminaRecoveryDelaySeconds ??= 0;
  state.staminaExhausted ??= false;
  const moving = isMoving(input);
  state.blocking = wantsBlock({ input, canBlock, stamina: state.stamina, exhausted: state.staminaExhausted });
  const sprinting = wantsSprint({ input, moving, blocking: state.blocking, stamina: state.stamina, exhausted: state.staminaExhausted });
  updateStamina({ state, moving, sprinting, dt });
  copyEffectiveInput({ target: output.input, source: input, sprinting, blocking: state.blocking });
  output.sprinting = sprinting;
  return output;
}

/** Mutates authoritative/predicted stamina and returns movement with invalid
 * sprint stripped. Blocking requires a weapon and always takes priority. */
export function stepPlayerResources(input: PlayerResourceInput): PlayerResourceStep {
  return stepPlayerResourcesInto({ ...input, output: createPlayerResourceStep() });
}
