import {
  TICK_RATE,
  faceEntity,
  resolveWeaponProfile,
  type EffectEvent,
} from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../state/state.js";
import { startActiveMeleeAttack } from "./melee/attackWindow.js";

export { stepActiveMeleeAttacks } from "./melee/attackWindow.js";

/** Starts an accepted player swing; its short contact window advances separately each tick. */
export interface AttackContext {
  sim: SimState;
  slot: PlayerSlot;
  dirX: number;
  dirY: number;
  effectEvents: EffectEvent[];
}

export function doAttack({ sim, slot, dirX, dirY, effectEvents }: AttackContext): void {
  const attacker = slot.entity;
  faceEntity(attacker, dirX, dirY);
  if (slot.blocking || sim.effects.inSanctuary(attacker)) return;
  const weaponDef = slot.weapon ? sim.content.items.get(slot.weapon) : undefined;
  const profile = resolveWeaponProfile(weaponDef);
  if (sim.tickCount < slot.attackReadyAtTick) return;
  slot.attackReadyAtTick = sim.tickCount + attackCooldownTicks(profile.cooldownMs);
  slot.attackStartedAtTick = sim.tickCount;
  startActiveMeleeAttack({
    sim,
    slot,
    weaponDef,
    profile,
    direction: { x: dirX, y: dirY },
    effectEvents,
  });
}

function attackCooldownTicks(cooldownMs: number): number {
  return Math.round((cooldownMs / 1000) * TICK_RATE);
}
