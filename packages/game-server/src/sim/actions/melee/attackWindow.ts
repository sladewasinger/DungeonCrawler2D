import {
  type EffectEvent,
  type ItemDef,
  type WeaponProfile,
} from "@dc2d/engine";
import { returnHostileProjectiles } from "../../projectiles/reflection.js";
import {
  activeMeleeAttackFor,
  clearActiveMeleeAttack,
  setActiveMeleeAttack,
  type ActiveMeleeAttack,
} from "../../state/meleeAttackState.js";
import type { PlayerSlot, SimState } from "../../state/state.js";
import { resolveMeleeContact } from "./contact.js";
import { targetsForActiveMeleeAttack } from "./targeting.js";

/** Ticks 0–3 at 20 Hz are 0, 50, 100, and 150 ms — never a 200 ms contact. */
const ACTIVE_MELEE_WINDOW_TICKS = 3;

export interface StartMeleeAttack {
  readonly sim: SimState;
  readonly slot: PlayerSlot;
  readonly weaponDef: ItemDef | undefined;
  readonly profile: WeaponProfile;
  readonly direction: { readonly x: number; readonly y: number };
  readonly effectEvents: EffectEvent[];
}

interface ActiveMeleeResolution {
  readonly sim: SimState;
  readonly slot: PlayerSlot;
  readonly attack: ActiveMeleeAttack;
  readonly effectEvents: EffectEvent[];
}

export function startActiveMeleeAttack(input: StartMeleeAttack): void {
  const attack = captureMeleeAttack(input);
  setActiveMeleeAttack(input.slot, attack);
  resolveActiveMeleeAttack({
    sim: input.sim,
    slot: input.slot,
    attack,
    effectEvents: input.effectEvents,
  });
}

export function stepActiveMeleeAttacks(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const slot of sim.players.values()) stepActiveMeleeAttack(sim, slot, effectEvents);
}

function captureMeleeAttack(input: StartMeleeAttack): ActiveMeleeAttack {
  return {
    startedAtTick: input.sim.tickCount,
    lastResolvedAtTick: Number.NEGATIVE_INFINITY,
    direction: { ...input.direction },
    profile: { ...input.profile },
    sourceTags: [...(input.weaponDef?.tags ?? [])],
    statusApplies: (input.weaponDef?.weapon?.applies ?? []).map((apply) => ({ ...apply })),
    hasContactedHostile: false,
    contactedEntityIds: new Set(),
  };
}

function stepActiveMeleeAttack(
  sim: SimState,
  slot: PlayerSlot,
  effectEvents: EffectEvent[],
): void {
  const attack = activeMeleeAttackFor(slot);
  if (!attack) return;
  if (!canContinueMeleeAttack(sim, slot, attack)) {
    clearActiveMeleeAttack(slot);
    return;
  }
  if (attack.lastResolvedAtTick === sim.tickCount) return;
  resolveActiveMeleeAttack({ sim, slot, attack, effectEvents });
}

function canContinueMeleeAttack(
  sim: SimState,
  slot: PlayerSlot,
  attack: ActiveMeleeAttack,
): boolean {
  if (!isWithinMeleeWindow(sim.tickCount, attack.startedAtTick)) return false;
  if (!slot.connected || slot.entity.hp <= 0 || slot.downedAtTick !== null) return false;
  if (slot.pendingTransfer !== null || slot.blocking) return false;
  return !sim.effects.inSanctuary(slot.entity);
}

function isWithinMeleeWindow(tick: number, startedAtTick: number): boolean {
  const elapsedTicks = tick - startedAtTick;
  return elapsedTicks >= 0 && elapsedTicks <= ACTIVE_MELEE_WINDOW_TICKS;
}

function resolveActiveMeleeAttack(input: ActiveMeleeResolution): void {
  const { sim, slot, attack, effectEvents } = input;
  attack.lastResolvedAtTick = sim.tickCount;
  returnHostileProjectiles({
    sim,
    attacker: slot.entity,
    direction: attack.direction,
    profile: attack.profile,
  });
  const victims = targetsForActiveMeleeAttack({ sim, slot, attack });
  for (const victim of victims) {
    resolveMeleeContact({ sim, attacker: slot.entity, attack, victim, effectEvents });
  }
}
