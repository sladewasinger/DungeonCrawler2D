/** Pure light survival Well-Fed and Rested hearth buff tuning and regeneration math. */

export const SURVIVAL_BUFF_TUNING = {
  wellFedHpRegenPerSec: 1.4,
  wellFedStaminaRegenBonus: 8,
  restedHearthRadiusTiles: 4.5,
  restedChargeSec: 5.0,
  restedDurationSec: 300,
  restedHpRegenPerSec: 0.8,
  restedStaminaRegenBonus: 10,
} as const;

export function computeSurvivalRegen(opts: {
  readonly wellFedTimer: number;
  readonly restedTimer: number;
  readonly hitTimer: number;
}): { readonly hpPerSec: number; readonly staminaBonusPerSec: number } {
  const fed = opts.wellFedTimer > 0;
  const rested = opts.restedTimer > 0;
  const canHeal = opts.hitTimer <= 0;
  const hpPerSec = canHeal
    ? (fed ? SURVIVAL_BUFF_TUNING.wellFedHpRegenPerSec : 0) + (rested ? SURVIVAL_BUFF_TUNING.restedHpRegenPerSec : 0)
    : 0;
  const staminaBonusPerSec = (fed ? SURVIVAL_BUFF_TUNING.wellFedStaminaRegenBonus : 0) + (rested ? SURVIVAL_BUFF_TUNING.restedStaminaRegenBonus : 0);
  return { hpPerSec, staminaBonusPerSec };
}
