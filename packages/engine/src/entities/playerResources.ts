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

const wantsBlock = (
  input: MoveInput,
  canBlock: boolean,
  stamina: number,
  exhausted: boolean,
): boolean =>
  Boolean(input.block) && canBlock && stamina > 0 && !exhausted;

const wantsSprint = (
  input: MoveInput,
  moving: boolean,
  blocking: boolean,
  stamina: number,
  exhausted: boolean,
): boolean =>
  Boolean(input.run) && moving && !blocking && stamina > 0 && !exhausted;

function updateStamina(
  state: PlayerResourceState,
  moving: boolean,
  sprinting: boolean,
  dt: number,
): void {
  state.staminaRecoveryDelaySeconds ??= 0;
  if (state.blocking) {
    drainStamina(state, BLOCK_STAMINA_PER_SECOND * dt);
    if (state.stamina === 0) state.blocking = false;
    return;
  }
  if (sprinting) {
    drainStamina(state, SPRINT_STAMINA_PER_SECOND * dt);
    return;
  }
  if (state.staminaRecoveryDelaySeconds > 0) {
    state.staminaRecoveryDelaySeconds = Math.max(
      0,
      state.staminaRecoveryDelaySeconds - dt,
    );
    return;
  }
  const recovery = moving
    ? WALK_STAMINA_RECOVERY_PER_SECOND
    : IDLE_STAMINA_RECOVERY_PER_SECOND;
  clampStamina(state, state.stamina + recovery * dt);
  if (
    state.staminaExhausted &&
    state.stamina >=
      state.maxStamina * STAMINA_EXHAUSTION_RECOVERY_FRACTION
  ) {
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

function copyEffectiveInput(
  target: MoveInput,
  source: MoveInput,
  sprinting: boolean,
  blocking: boolean,
): void {
  target.moveX = source.moveX;
  target.moveY = source.moveY;
  target.faceX = source.faceX;
  target.faceY = source.faceY;
  target.jump = source.jump;
  target.run = sprinting;
  target.block = blocking;
}

/** Allocation-free resource step for fixed simulation and render projection hot paths. */
export function stepPlayerResourcesInto(
  state: PlayerResourceState,
  input: MoveInput,
  canBlock: boolean,
  dt: number,
  output: PlayerResourceStep,
): PlayerResourceStep {
  state.staminaRecoveryDelaySeconds ??= 0;
  state.staminaExhausted ??= false;
  const moving = isMoving(input);
  state.blocking = wantsBlock(
    input,
    canBlock,
    state.stamina,
    state.staminaExhausted,
  );
  const sprinting = wantsSprint(
    input,
    moving,
    state.blocking,
    state.stamina,
    state.staminaExhausted,
  );
  updateStamina(state, moving, sprinting, dt);
  copyEffectiveInput(output.input, input, sprinting, state.blocking);
  output.sprinting = sprinting;
  return output;
}

/** Mutates authoritative/predicted stamina and returns movement with invalid
 * sprint stripped. Blocking requires a weapon and always takes priority. */
export function stepPlayerResources(
  state: PlayerResourceState,
  input: MoveInput,
  canBlock: boolean,
  dt: number,
): PlayerResourceStep {
  return stepPlayerResourcesInto(
    state,
    input,
    canBlock,
    dt,
    createPlayerResourceStep(),
  );
}
