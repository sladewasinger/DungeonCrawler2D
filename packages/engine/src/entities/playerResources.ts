import {
  BLOCK_STAMINA_PER_SECOND,
  IDLE_STAMINA_RECOVERY_PER_SECOND,
  SPRINT_STAMINA_PER_SECOND,
  WALK_STAMINA_RECOVERY_PER_SECOND,
} from "../core/constants.js";
import type { MoveInput } from "./movement/state.js";

export interface PlayerResourceState {
  stamina: number;
  maxStamina: number;
  blocking: boolean;
}

export interface PlayerResourceStep {
  readonly input: MoveInput;
  readonly sprinting: boolean;
}

const clampStamina = (state: PlayerResourceState, value: number): void => {
  state.stamina = Math.max(0, Math.min(state.maxStamina, value));
};

const isMoving = (input: MoveInput): boolean =>
  input.moveX !== 0 || input.moveY !== 0;

const wantsBlock = (
  input: MoveInput,
  canBlock: boolean,
  stamina: number,
): boolean => Boolean(input.block) && canBlock && stamina > 0;

const wantsSprint = (
  input: MoveInput,
  moving: boolean,
  blocking: boolean,
  stamina: number,
): boolean => Boolean(input.run) && moving && !blocking && stamina > 0;

function updateStamina(
  state: PlayerResourceState,
  moving: boolean,
  sprinting: boolean,
  dt: number,
): void {
  if (state.blocking) {
    clampStamina(state, state.stamina - BLOCK_STAMINA_PER_SECOND * dt);
    if (state.stamina === 0) state.blocking = false;
    return;
  }
  if (sprinting) {
    clampStamina(state, state.stamina - SPRINT_STAMINA_PER_SECOND * dt);
    return;
  }
  const recovery = moving
    ? WALK_STAMINA_RECOVERY_PER_SECOND
    : IDLE_STAMINA_RECOVERY_PER_SECOND;
  clampStamina(state, state.stamina + recovery * dt);
}

/** Mutates authoritative/predicted stamina and returns movement with invalid
 * sprint stripped. Blocking requires a weapon and always takes priority. */
export function stepPlayerResources(
  state: PlayerResourceState,
  input: MoveInput,
  canBlock: boolean,
  dt: number,
): PlayerResourceStep {
  const moving = isMoving(input);
  state.blocking = wantsBlock(input, canBlock, state.stamina);
  const sprinting = wantsSprint(input, moving, state.blocking, state.stamina);
  updateStamina(state, moving, sprinting, dt);

  return {
    input: {
      ...input,
      run: sprinting,
      block: state.blocking,
    },
    sprinting,
  };
}
