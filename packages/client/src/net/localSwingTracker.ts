/** Client-side 60fps predicted melee swing state, combo counter, and world event emitter. */
import type { PlayerSnapshot, WorldEvent } from "@dc2d/engine";
import { MELEE_SWING_TUNING } from "../render/combat/combatVisualTuning.js";

const NON_MELEE_ITEMS = new Set(["bow", "bandage", "cooked-meat"]);

export class LocalSwingTracker {
  private swingTimer = 0;
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

  private canTriggerSwing(opts: { readonly attack: boolean; readonly heldId: string | null; readonly stamina: number | undefined }): boolean {
    if (!opts.attack || this.cooldown > 0 || (opts.stamina ?? 100) < 12) return false;
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
    if (!this.canTriggerSwing({ attack: opts.attack, heldId: opts.heldId, stamina: opts.player.stamina })) return;
    this.swingTimer = MELEE_SWING_TUNING.durationSec;
    this.cooldown = MELEE_SWING_TUNING.cooldownSec;
    this.comboStep = this.comboReset > 0 ? (this.comboStep % 3) + 1 : 1;
    this.comboReset = MELEE_SWING_TUNING.comboWindowSec;
    this.aim = opts.normAim ?? { x: opts.player.facingX, y: opts.player.facingY };
    this.predicted = opts.isServer;
    opts.events.push({
      kind: "swing", x: opts.player.x, y: opts.player.y,
      dirX: this.aim.x, dirY: this.aim.y, actorId: opts.player.id, comboStep: this.comboStep,
    });
  }

  activeProgress(fallback: number | undefined): number {
    return this.swingTimer > 0 ? 1 - this.swingTimer / MELEE_SWING_TUNING.durationSec : (fallback ?? 0);
  }

  snapshotOverride(): Partial<PlayerSnapshot> {
    if (this.swingTimer <= 0) return {};
    return {
      swingProgress: 1 - this.swingTimer / MELEE_SWING_TUNING.durationSec,
      comboStep: this.comboStep,
      aimX: this.aim.x,
      aimY: this.aim.y,
    };
  }
}
