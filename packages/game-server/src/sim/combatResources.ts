import {
  HEALTH_REGEN_DELAY_SECONDS,
  HEALTH_REGEN_PER_SECOND,
  PLAYER_MAX_STAMINA,
  TICK_DT,
  TICK_RATE,
  stepPlayerResources,
  type ClientInput,
  type EffectEvent,
  type MoveInput,
} from "@dc2d/engine";
import type { PlayerSlot, SimState } from "./state.js";

const REGEN_DELAY_TICKS = Math.ceil(HEALTH_REGEN_DELAY_SECONDS * TICK_RATE);

const ensureResourceState = (slot: PlayerSlot) => {
  slot.maxStamina ??= PLAYER_MAX_STAMINA;
  slot.stamina ??= slot.maxStamina;
  slot.blocking ??= false;
  return {
    stamina: slot.stamina,
    maxStamina: slot.maxStamina,
    blocking: slot.blocking,
  };
};

/** Resolves held sprint/block intent and commits the authoritative stamina step. */
export function advancePlayerResources(
  slot: PlayerSlot,
  input: ClientInput | MoveInput,
): MoveInput {
  const resources = ensureResourceState(slot);
  const normalized: MoveInput = {
    moveX: input.moveX,
    moveY: input.moveY,
    ...(input.faceX !== undefined ? { faceX: input.faceX } : {}),
    ...(input.faceY !== undefined ? { faceY: input.faceY } : {}),
    jump: input.jump,
    run: input.run ?? false,
    block: input.block ?? false,
  };
  const step = stepPlayerResources(
    resources,
    normalized,
    slot.weapon !== null,
    TICK_DT,
  );
  slot.stamina = resources.stamina;
  slot.maxStamina = resources.maxStamina;
  slot.blocking = resources.blocking;
  return step.input;
}

/** Records hostile health loss before applying slow post-combat regeneration. */
export function applyHealthRegeneration(
  sim: SimState,
  effectEvents: EffectEvent[],
): void {
  for (const event of effectEvents) {
    if (event.t !== "hp" || event.delta >= 0) continue;
    const slot = sim.players.get(event.id);
    if (slot) slot.lastDamageAtTick = sim.tickCount;
  }

  for (const slot of sim.players.values()) {
    if (!canRegenerate(sim, slot)) continue;
    sim.effects.modifyHealth(
      slot.entity,
      HEALTH_REGEN_PER_SECOND,
      effectEvents,
    );
  }
}

function canRegenerate(sim: SimState, slot: PlayerSlot): boolean {
  const entity = slot.entity;
  slot.lastDamageAtTick ??= sim.tickCount;
  if (!slot.connected || entity.hp <= 0 || entity.hp >= entity.maxHp) return false;
  if (slot.downedAtTick !== null) return false;
  if (sim.tickCount - slot.lastDamageAtTick < REGEN_DELAY_TICKS) return false;
  return sim.tickCount % TICK_RATE === 0;
}
