/** Client-side 60fps predicted melee swing state, combo counter, and world event emitter. */
import { getItemDef } from "@dc2d/content";
import { resolveWeaponArchetype, resolveWeaponAttackStep, type PlayerSnapshot, type WorldEvent } from "@dc2d/engine";

const NON_MELEE_ITEMS = new Set(["bow", "bandage", "cooked-meat", "map", "stone"]);

export class LocalSwingTracker {
  private swingTimer = 0;
  private swingDuration = 0.25;
  private cooldown = 0;
  private comboReset = 0;
  private comboStep = 0;
  private aim = { x: 0, y: 1 };
  private predicted = false;

  hasPendingServerSwing(): boolean {
    return this.predicted;
  }

  clearPendingServerSwing(): void {
    this.predicted = false;
  }

  private canTriggerSwing(opts: {
    readonly attack: boolean; readonly heldId: string | null; readonly stamina: number | undefined;
    readonly cost: number; readonly placeable: boolean;
  }): boolean {
    if (!opts.attack || this.cooldown > 0 || opts.placeable || (opts.stamina ?? 100) < opts.cost) return false;
    return !(opts.heldId && NON_MELEE_ITEMS.has(opts.heldId));
  }

  step(opts: {
    readonly dt: number;
    readonly attack: boolean;
    readonly heldId: string | null;
    readonly player: PlayerSnapshot;
    readonly normAim: { readonly x: number; readonly y: number } | undefined;
    readonly isServer: boolean;
    readonly events: WorldEvent[];
  }): void {
    this.swingTimer = Math.max(0, this.swingTimer - opts.dt);
    this.cooldown = Math.max(0, this.cooldown - opts.dt);
    this.comboReset = Math.max(0, this.comboReset - opts.dt);
    const def = opts.heldId ? getItemDef(opts.heldId) : undefined;
    if (!this.canTriggerSwing({ attack: opts.attack, heldId: opts.heldId, stamina: opts.player.stamina, cost: def?.staminaCost ?? 8, placeable: Boolean(def?.placeStructure) })) return;
    const archetype = resolveWeaponArchetype(opts.heldId, def?.weaponArchetype);
    const { stepIndex, moveset, spec } = resolveWeaponAttackStep({ archetype, currentStep: this.comboStep, comboActive: this.comboReset > 0 });
    this.swingDuration = spec.swingDurationSec;
    this.swingTimer = spec.swingDurationSec;
    this.cooldown = spec.swingDurationSec * spec.cooldownRatio;
    this.comboStep = stepIndex;
    this.comboReset = moveset.comboWindowSec;
    this.aim = opts.normAim ?? { x: opts.player.facingX, y: opts.player.facingY };
    this.predicted = opts.isServer;
    opts.events.push({
      kind: "swing", x: opts.player.x, y: opts.player.y,
      dirX: this.aim.x, dirY: this.aim.y, actorId: opts.player.id, comboStep: this.comboStep, weaponArchetype: archetype,
    });
  }

  activeProgress(fallback: number | undefined): number {
    return this.swingTimer > 0 ? 1 - this.swingTimer / this.swingDuration : (fallback ?? 0);
  }

  snapshotOverride(): Partial<PlayerSnapshot> {
    if (this.swingTimer <= 0) return {};
    return {
      swingProgress: 1 - this.swingTimer / this.swingDuration,
      comboStep: this.comboStep,
      aimX: this.aim.x,
      aimY: this.aim.y,
    };
  }
}
