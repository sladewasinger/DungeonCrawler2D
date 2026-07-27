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

export const healthRegenerationDelaySeconds = (
  sim: SimState,
  slot: PlayerSlot,
): number => Math.max(
  0,
  ((slot.lastDamageAtTick ?? sim.tickCount) + REGEN_DELAY_TICKS -
    sim.tickCount) / TICK_RATE,
);

const ensureResourceState = (slot: PlayerSlot) => {
  slot.maxStamina ??= PLAYER_MAX_STAMINA;
  slot.stamina ??= slot.maxStamina;
  slot.blocking ??= false;
  slot.staminaRecoveryDelaySeconds ??= 0;
  slot.staminaExhausted ??= false;
  return {
    stamina: slot.stamina,
    maxStamina: slot.maxStamina,
    blocking: slot.blocking,
    staminaRecoveryDelaySeconds: slot.staminaRecoveryDelaySeconds,
    staminaExhausted: slot.staminaExhausted,
  };
};

function refillGodStamina(
  resources: ReturnType<typeof ensureResourceState>,
): void {
  resources.stamina = resources.maxStamina;
  resources.staminaRecoveryDelaySeconds = 0;
  resources.staminaExhausted = false;
}

/** Resolves held sprint/block intent and commits the authoritative stamina step. */
export function advancePlayerResources(
  slot: PlayerSlot,
  input: ClientInput | MoveInput,
): MoveInput {
  const resources = ensureResourceState(slot);
  if (slot.god) refillGodStamina(resources);
  const step = stepPlayerResources({
    state: resources,
    input: normalizeInput(input),
    canBlock: slot.weapon !== null,
    dt: TICK_DT,
  });
  if (slot.god) refillGodStamina(resources);
  commitResourceState(slot, resources);
  return step.input;
}

function normalizeInput(input: ClientInput | MoveInput): MoveInput {
  return {
    moveX: input.moveX,
    moveY: input.moveY,
    ...(input.faceX !== undefined ? { faceX: input.faceX } : {}),
    ...(input.faceY !== undefined ? { faceY: input.faceY } : {}),
    jump: input.jump,
    run: input.run ?? false,
    block: input.block ?? false,
  };
}

function commitResourceState(slot: PlayerSlot, resources: ReturnType<typeof ensureResourceState>): void {
  slot.stamina = resources.stamina;
  slot.maxStamina = resources.maxStamina;
  slot.blocking = resources.blocking;
  slot.staminaRecoveryDelaySeconds = resources.staminaRecoveryDelaySeconds;
  slot.staminaExhausted = resources.staminaExhausted;
}

/** Records hostile health loss before applying slow post-combat regeneration. */
export function applyHealthRegeneration(
  sim: SimState,
  effectEvents: EffectEvent[],
): void {
  recordDamageTimes(sim, effectEvents);
  regenerateEligiblePlayers(sim, effectEvents);
}

function recordDamageTimes(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const event of effectEvents) recordDamageTime(sim, event);
}

function recordDamageTime(sim: SimState, event: EffectEvent): void {
  if (event.t !== "hp" || event.delta >= 0) return;
  const slot = sim.players.get(event.id);
  if (slot) slot.lastDamageAtTick = sim.tickCount;
}

function regenerateEligiblePlayers(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const slot of sim.players.values()) {
    if (!canRegenerate(sim, slot)) continue;
    sim.effects.modifyHealth({
      entity: slot.entity,
      amount: HEALTH_REGEN_PER_SECOND,
      events: effectEvents,
      opts: { healthSource: "automatic" },
    });
  }
}

function canRegenerate(sim: SimState, slot: PlayerSlot): boolean {
  const entity = slot.entity;
  slot.lastDamageAtTick ??= sim.tickCount;
  if (!slot.connected || slot.respawnAtTick !== null) return false;
  if (entity.hp <= 0 || entity.hp >= entity.maxHp) return false;
  if (slot.downedAtTick !== null) return false;
  if (sim.tickCount - slot.lastDamageAtTick < REGEN_DELAY_TICKS) return false;
  return sim.tickCount % TICK_RATE === 0;
}
