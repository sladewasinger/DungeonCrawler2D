/** Pure light survival Well-Fed, Invigorated, Rested, and Herbal Salve buff tuning and regeneration math. */

export const SURVIVAL_BUFF_TUNING = {
  wellFedMaxHpBonus: 15,
  wellFedHpRegenPerSec: 1.4,
  wellFedStaminaRegenBonus: 8,
  invigoratedDurationSec: 180,
  invigoratedStaminaRegenBonus: 16,
  invigoratedExhaustionDelayMult: 0.5,
  restedHearthRadiusTiles: 4.5,
  restedChargeSec: 5.0,
  restedDurationSec: 300,
  restedHpRegenPerSec: 0.8,
  restedStaminaRegenBonus: 10,
  salveHotDurationSec: 4.0,
  salveHotTotalHp: 55,
} as const;

export function applyWellFedDuration(currentSec: number, addedSec: number): number {
  return Math.max(currentSec, addedSec);
}

function passiveHpRegenPerSec(fed: boolean, rested: boolean, hitTimer: number): number {
  if (hitTimer > 0) return 0;
  return (fed ? SURVIVAL_BUFF_TUNING.wellFedHpRegenPerSec : 0) + (rested ? SURVIVAL_BUFF_TUNING.restedHpRegenPerSec : 0);
}

function staminaBonusForBuffs(fed: boolean, rested: boolean, invigorated: boolean): number {
  return (fed ? SURVIVAL_BUFF_TUNING.wellFedStaminaRegenBonus : 0)
    + (rested ? SURVIVAL_BUFF_TUNING.restedStaminaRegenBonus : 0)
    + (invigorated ? SURVIVAL_BUFF_TUNING.invigoratedStaminaRegenBonus : 0);
}

export function computeSurvivalRegen(opts: {
  readonly wellFedTimer: number;
  readonly restedTimer: number;
  readonly invigoratedTimer?: number | undefined;
  readonly hotTimer?: number | undefined;
  readonly hitTimer: number;
}): { readonly hpPerSec: number; readonly staminaBonusPerSec: number; readonly maxHpBonus: number } {
  const fed = opts.wellFedTimer > 0;
  const rested = opts.restedTimer > 0;
  const invigorated = (opts.invigoratedTimer ?? 0) > 0;
  const hotHpPerSec = (opts.hotTimer ?? 0) > 0 ? SURVIVAL_BUFF_TUNING.salveHotTotalHp / SURVIVAL_BUFF_TUNING.salveHotDurationSec : 0;
  return {
    hpPerSec: passiveHpRegenPerSec(fed, rested, opts.hitTimer) + hotHpPerSec,
    staminaBonusPerSec: staminaBonusForBuffs(fed, rested, invigorated),
    maxHpBonus: fed ? SURVIVAL_BUFF_TUNING.wellFedMaxHpBonus : 0,
  };
}
