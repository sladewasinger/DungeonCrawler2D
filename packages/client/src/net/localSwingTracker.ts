/** Client-side 60fps predicted melee timeline (windup/heavy-hold, dodge-cancel, 0.18s buffer) & SFX/VFX trigger. */
import { getItemDef, isMeleeItem } from "@dc2d/content";
import {
  MELEE_FEEL_TUNING, getWeaponStepSpec, resolveWeaponArchetype, resolveWeaponAttackStep,
  type PlayerSnapshot, type WorldEvent,
} from "@dc2d/engine";

export class LocalSwingTracker {
  private swingTimer = 0;
  private swingDuration = 0.25;
  private elapsedSec = 0;
  private windupEnd = 0.25;
  private cooldown = 0;
  private comboReset = 0;
  private comboStep = 0;
  private heavyChargeSec = 0;
  private heavyReleased = false;
  private bufferTimer = 0;
  private bufferedAttack = false;
  private aim = { x: 0, y: 1 };
  private predicted = false;

  hasPendingServerSwing(): boolean { return this.predicted; }
  clearPendingServerSwing(): void { this.predicted = false; }

  private canTriggerSwing(opts: {
    readonly attack: boolean; readonly heldId: string | null; readonly stamina: number | undefined;
    readonly cost: number; readonly placeable: boolean;
  }): boolean {
    if (!opts.attack || this.cooldown > 0 || opts.placeable || (opts.stamina ?? 100) < opts.cost) return false;
    return isMeleeItem(opts.heldId);
  }

  private tryCancelOnDodge(dodge: boolean): boolean {
    if (!dodge || this.swingTimer <= 0) return false;
    const maxCancel = this.swingDuration * this.windupEnd * MELEE_FEEL_TUNING.dodgeCancelWindupRatio;
    if (this.elapsedSec > maxCancel) return false;
    this.swingTimer = 0; this.cooldown = 0; this.heavyChargeSec = 0;
    return true;
  }

  private advanceActiveSwing(dt: number, attackHold: boolean): void {
    if (this.swingTimer <= 0) return;
    if (!this.heavyReleased && !attackHold) this.heavyReleased = true;
    const windupSec = this.swingDuration * this.windupEnd;
    if (!this.heavyReleased && attackHold && this.elapsedSec + dt >= windupSec) {
      this.elapsedSec = windupSec;
      this.heavyChargeSec = Math.min(MELEE_FEEL_TUNING.heavyHoldMaxSec, this.heavyChargeSec + dt);
      this.swingTimer = Math.max(0.02, this.swingDuration - this.elapsedSec);
      this.cooldown = Math.max(this.cooldown, this.swingTimer);
      return;
    }
    this.elapsedSec += dt;
    this.swingTimer = Math.max(0, this.swingTimer - dt);
    if (this.swingTimer <= 0) this.heavyChargeSec = 0;
  }

  private tickTimersAndCancel(dt: number, dodge: boolean, attackHold: boolean): boolean {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.comboReset = Math.max(0, this.comboReset - dt);
    this.bufferTimer = Math.max(0, this.bufferTimer - dt);
    if (this.bufferTimer <= 0) this.bufferedAttack = false;
    if (this.tryCancelOnDodge(dodge)) return true;
    this.advanceActiveSwing(dt, attackHold);
    return false;
  }

  private queueAttackIfBusy(attack: boolean): boolean {
    if (attack && (this.cooldown > 0 || this.swingTimer > 0)) {
      this.bufferedAttack = true;
      this.bufferTimer = MELEE_FEEL_TUNING.inputBufferSec;
    }
    return attack || this.bufferedAttack;
  }

  step(opts: {
    readonly dt: number; readonly attack: boolean; readonly attackHold?: boolean;
    readonly dodge?: boolean; readonly heldId: string | null; readonly player: PlayerSnapshot;
    readonly normAim: { readonly x: number; readonly y: number } | undefined;
    readonly isServer: boolean; readonly events: WorldEvent[];
  }): void {
    if (this.tickTimersAndCancel(opts.dt, Boolean(opts.dodge), Boolean(opts.attackHold))) return;
    const wantsSwing = this.queueAttackIfBusy(opts.attack);
    const def = opts.heldId ? getItemDef(opts.heldId) : undefined;
    const ok = this.canTriggerSwing({ attack: wantsSwing, heldId: opts.heldId, stamina: opts.player.stamina, cost: def?.staminaCost ?? 8, placeable: Boolean(def?.placeStructure) });
    if (ok) this.startSwing({ heldId: opts.heldId, def, opts });
  }

  private startSwing(cfg: {
    readonly heldId: string | null; readonly def: ReturnType<typeof getItemDef>;
    readonly opts: { readonly player: PlayerSnapshot; readonly normAim: { readonly x: number; readonly y: number } | undefined; readonly isServer: boolean; readonly events: WorldEvent[] };
  }): void {
    const { opts } = cfg;
    const archetype = resolveWeaponArchetype(cfg.heldId, cfg.def?.weaponArchetype);
    const { stepIndex, moveset, spec } = resolveWeaponAttackStep({ archetype, currentStep: this.comboStep, comboActive: this.comboReset > 0 });
    this.swingDuration = spec.swingDurationSec; this.swingTimer = spec.swingDurationSec;
    this.elapsedSec = 0; this.windupEnd = spec.windupEnd; this.heavyChargeSec = 0; this.heavyReleased = false;
    this.cooldown = spec.swingDurationSec * spec.cooldownRatio; this.comboStep = stepIndex;
    this.comboReset = moveset.comboWindowSec; this.bufferedAttack = false; this.bufferTimer = 0;
    this.aim = opts.normAim ?? { x: opts.player.facingX, y: opts.player.facingY };
    this.predicted = opts.isServer;
    opts.events.push({
      kind: "swing", x: opts.player.x, y: opts.player.y, dirX: this.aim.x, dirY: this.aim.y,
      actorId: opts.player.id, comboStep: this.comboStep, weaponArchetype: archetype, sweepDir: getWeaponStepSpec(archetype, stepIndex).sweepDir,
    });
  }

  activeProgress(fallback: number | undefined): number {
    return this.swingTimer > 0 ? Math.min(1, this.elapsedSec / Math.max(0.01, this.swingDuration)) : (fallback ?? 0);
  }

  snapshotOverride(): Partial<PlayerSnapshot> {
    if (this.swingTimer <= 0) return {};
    return {
      swingProgress: this.activeProgress(0),
      heavyCharge: this.heavyChargeSec > 0 ? this.heavyChargeSec / MELEE_FEEL_TUNING.heavyHoldMaxSec : undefined,
      comboStep: this.comboStep,
      aimX: this.aim.x,
      aimY: this.aim.y,
    };
  }
}
