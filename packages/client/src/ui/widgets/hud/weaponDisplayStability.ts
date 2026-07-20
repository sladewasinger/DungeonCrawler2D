/**
 * Weapon-chip display debounce: the HUD's equipped-weapon label is fed the raw
 * per-snapshot `weapon` field, and any single sub-tick where the server truth reads
 * unarmed (e.g. a drop/re-equip landing across adjacent ticks) reads as a flicker
 * ("bounced between Rusty Sword and Unarmed across the same fight" — TOURIST). A
 * real equip (a non-null weapon id) always commits instantly — that's a deliberate
 * player action and must feel responsive. Only the drop TO unarmed is held briefly,
 * so a legitimate sustained unequip still reads correctly a moment later. Pure so
 * the debounce edge is unit-testable apart from the Phaser Text it drives.
 */
export interface WeaponDisplayState {
  readonly id: string | null;
  /** Wall-clock ms the incoming id first read null this streak, or null while armed. */
  readonly nullSinceMs: number | null;
}

export const WEAPON_UNEQUIP_HOLD_MS = 200;

export function initialWeaponDisplay(): WeaponDisplayState {
  return { id: null, nullSinceMs: null };
}

/** Advances the debounced display id for one frame's incoming raw weapon id. */
export function nextWeaponDisplay(
  state: WeaponDisplayState,
  incomingId: string | null,
  nowMs: number,
): WeaponDisplayState {
  if (incomingId !== null) return { id: incomingId, nullSinceMs: null };
  const since = state.nullSinceMs ?? nowMs;
  if (nowMs - since >= WEAPON_UNEQUIP_HOLD_MS) return { id: null, nullSinceMs: since };
  return { id: state.id, nullSinceMs: since };
}
