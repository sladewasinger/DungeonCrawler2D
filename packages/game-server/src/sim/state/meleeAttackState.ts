import type { WeaponProfile } from "@dc2d/engine";
import type { PlayerSlot } from "./state.js";

export interface MeleeStatusPayload {
  readonly status: string;
  readonly chance: number;
}

/** Immutable combat input captured once when a player swing is accepted. */
export interface ActiveMeleeAttack {
  /** Acceptance tick; offsets 0 through 3 are the 160 ms attack window. */
  readonly startedAtTick: number;
  /** Makes an immediate acceptance resolution and the tick advance idempotent. */
  lastResolvedAtTick: number;
  /** Aim and weapon values never follow later movement, equip, or aim changes. */
  readonly direction: { readonly x: number; readonly y: number };
  readonly profile: WeaponProfile;
  readonly sourceTags: readonly string[];
  readonly statusApplies: readonly MeleeStatusPayload[];
  /** Once set, party fallback stays suppressed for this temporal swing. */
  hasContactedHostile: boolean;
  /** Includes blocked contacts so a target cannot be contacted twice per swing. */
  readonly contactedEntityIds: Set<string>;
}

const activeMeleeAttacks = new WeakMap<PlayerSlot, ActiveMeleeAttack>();

export function activeMeleeAttackFor(slot: PlayerSlot): ActiveMeleeAttack | undefined {
  return activeMeleeAttacks.get(slot);
}

export function setActiveMeleeAttack(slot: PlayerSlot, attack: ActiveMeleeAttack): void {
  activeMeleeAttacks.set(slot, attack);
}

export function clearActiveMeleeAttack(slot: PlayerSlot): void {
  activeMeleeAttacks.delete(slot);
}
