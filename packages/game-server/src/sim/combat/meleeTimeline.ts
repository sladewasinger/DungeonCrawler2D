/** Server-authoritative 3-phase melee timeline (Windup -> Active -> Recovery), heavy hold, and input buffer. */
import {
  MELEE_FEEL_TUNING, STEALTH_TUNING, resolveWeaponAttackStep,
  type GoreStyle, type WeaponArchetype, type WeaponMovesetSpec, type WeaponStepSpec, type WorldEvent,
} from "@dc2d/engine";

export interface PendingMeleeSwing {
  readonly heldId: string | null;
  readonly archetype: WeaponArchetype;
  readonly stepIndex: number;
  readonly moveset: WeaponMovesetSpec;
  readonly spec: WeaponStepSpec;
  readonly baseDamage: number;
  readonly range: number;
  readonly halfArcRad: number;
  readonly goreStyle: GoreStyle;
  readonly harvestPower: number;
  readonly shieldPoke: boolean;
  readonly durationSec: number;
  elapsedSec: number;
  heavyChargeSec: number;
  isHeavy: boolean;
  released: boolean;
  readonly aimX: number;
  readonly aimY: number;
  readonly hitTargetIds: Set<string>;
  harvested: boolean;
  slamEmitted: boolean;
  noiseEmitted: boolean;
}

export interface BufferedCombatAction {
  readonly kind: "attack" | "dodge";
  readonly expiresSec: number;
  readonly dodgeDirX?: number | undefined;
  readonly dodgeDirY?: number | undefined;
}

export interface SwingInitState {
  comboStep: number;
  comboResetTimer: number;
  swingTimer: number;
  swingDuration: number;
  heavyCharge: number;
  blocking: boolean;
  stamina: number;
  godMode?: boolean;
  actionCooldown: number;
  pendingSwing: PendingMeleeSwing | null;
}

export function canDodgeCancelSwing(swing: PendingMeleeSwing | null): boolean {
  if (!swing || swing.hitTargetIds.size > 0) return false;
  const maxCancel = swing.durationSec * swing.spec.windupEnd * MELEE_FEEL_TUNING.dodgeCancelWindupRatio;
  return swing.elapsedSec <= maxCancel;
}

function trySpendSwingStamina(state: SwingInitState, cost: number): boolean {
  if (state.godMode) return true;
  if (state.stamina < cost) return false;
  state.stamina -= cost;
  return true;
}

export function buildPendingSwing(opts: {
  readonly state: SwingInitState;
  readonly heldId: string | null;
  readonly archetype: WeaponArchetype;
  readonly stats: { readonly cost: number; readonly damage: number; readonly range: number; readonly halfArc: number; readonly gore: GoreStyle; readonly harvestPower?: number | undefined };
  readonly aim: { readonly x: number; readonly y: number };
  readonly shieldPoke: boolean;
}): PendingMeleeSwing | null {
  const { state, heldId, archetype, stats, aim, shieldPoke } = opts;
  if (!trySpendSwingStamina(state, stats.cost)) return null;
  const { stepIndex, moveset, spec } = resolveWeaponAttackStep({ archetype, currentStep: state.comboStep, comboActive: state.comboResetTimer > 0 });
  const durationSec = shieldPoke ? MELEE_FEEL_TUNING.shieldPokeDurationSec : spec.swingDurationSec;
  state.comboStep = stepIndex;
  state.comboResetTimer = moveset.comboWindowSec;
  state.swingDuration = durationSec;
  state.swingTimer = durationSec;
  state.heavyCharge = 0;
  if (!shieldPoke) state.blocking = false;
  state.actionCooldown = shieldPoke ? durationSec * 0.9 : spec.swingDurationSec * spec.cooldownRatio;
  const pending: PendingMeleeSwing = {
    heldId, archetype, stepIndex, moveset, spec, shieldPoke, durationSec,
    harvestPower: stats.harvestPower ?? moveset.harvestPower,
    baseDamage: Math.round(stats.damage * spec.damageMult * (shieldPoke ? MELEE_FEEL_TUNING.shieldPokeDamageMult : 1)),
    range: stats.range * spec.rangeMult,
    halfArcRad: stats.halfArc * spec.arcMult,
    goreStyle: spec.goreOverride ?? stats.gore,
    elapsedSec: 0, heavyChargeSec: 0, isHeavy: false, released: false,
    aimX: aim.x, aimY: aim.y, hitTargetIds: new Set<string>(), harvested: false, slamEmitted: false, noiseEmitted: false,
  };
  state.pendingSwing = pending;
  return pending;
}

export function shouldHoldHeavyWindup(swing: PendingMeleeSwing, attackHold: boolean, dt: number): boolean {
  if (swing.shieldPoke || swing.released) return false;
  if (!attackHold) { swing.released = true; return false; }
  const windupSec = swing.durationSec * swing.spec.windupEnd;
  return swing.elapsedSec + dt >= windupSec;
}

export function advanceHeavyCharge(opts: {
  readonly state: SwingInitState;
  readonly swing: PendingMeleeSwing;
  readonly dt: number;
  readonly pos: { readonly x: number; readonly y: number; readonly id: string };
  readonly events: WorldEvent[];
}): void {
  const { state, swing, dt, pos, events } = opts;
  swing.elapsedSec = swing.durationSec * swing.spec.windupEnd;
  swing.heavyChargeSec = Math.min(MELEE_FEEL_TUNING.heavyHoldMaxSec, swing.heavyChargeSec + dt);
  state.heavyCharge = swing.heavyChargeSec / MELEE_FEEL_TUNING.heavyHoldMaxSec;
  state.swingTimer = Math.max(0.02, swing.durationSec - swing.elapsedSec);
  state.actionCooldown = Math.max(state.actionCooldown, state.swingTimer);
  if (!swing.isHeavy && swing.heavyChargeSec >= MELEE_FEEL_TUNING.heavyHoldMinSec) {
    swing.isHeavy = true;
    if (!state.godMode) state.stamina = Math.max(0, state.stamina - Math.min(state.stamina, MELEE_FEEL_TUNING.heavyStaminaExtra));
    events.push({ kind: "heavyCharge", x: pos.x, y: pos.y, actorId: pos.id, weaponArchetype: swing.archetype });
  }
}

export function swingOverlapsActive(opts: {
  readonly swing: PendingMeleeSwing;
  readonly prevElapsed: number;
  readonly nextElapsed: number;
}): boolean {
  const dur = Math.max(0.01, opts.swing.durationSec);
  const p0 = opts.prevElapsed / dur;
  const p1 = opts.nextElapsed / dur;
  return p1 >= opts.swing.spec.windupEnd && p0 <= opts.swing.spec.activeEnd;
}

export function computeSwingNoiseRadius(crouching: boolean | undefined): number {
  return crouching ? 2.2 : STEALTH_TUNING.combatNoiseRadiusTiles;
}
