import weaponHitboxTuning from "./weaponHitboxTuning.json" with { type: "json" };

export interface WeaponHitboxTuning {
  /** Wall-clock presentation/contact lifetime shared by every melee wielder. */
  readonly activeDurationMs: number;
  /** Vertical center above the attacker's feet, in world tiles. */
  readonly strikeHeightOffset: number;
  /** Half of the authoritative vertical thickness, in world tiles. */
  readonly verticalHalfExtent: number;
}

export const WEAPON_HITBOX_TUNING: WeaponHitboxTuning = weaponHitboxTuning;
