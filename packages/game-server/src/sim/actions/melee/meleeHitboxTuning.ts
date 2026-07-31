import meleeHitboxTuning from "./meleeHitboxTuning.json" with { type: "json" };

interface MeleeHitboxTuning {
  /** Inclusive offsets 0..N during which one accepted swing can contact. */
  readonly activeWindowTicks: number;
}

export const MELEE_HITBOX_TUNING: MeleeHitboxTuning = meleeHitboxTuning;
