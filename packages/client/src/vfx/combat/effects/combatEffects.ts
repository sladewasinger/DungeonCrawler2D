import type Phaser from "phaser";
import { worldToScreen } from "../../../render/entities/geometry/worldToScreen.js";
import { BloodDecalPool } from "../../blood/bloodDecalPool.js";
import { isSkeletalDefId, spawnBoneChipBurst } from "../../death/boneChipBurst.js";
import { spawnDeathSplatter, spawnHitSplatter } from "../../blood/bloodSplatter.js";
import { bloodTintFor } from "../../blood/bloodTint.js";
import { loadCarnageSettings } from "../../system/carnageSettings.js";
import { CorpseDecalPool } from "../../death/corpseDecalPool.js";
import { DeathCarnagePool, type CarnageAppearance } from "../../death/deathCarnagePool.js";
import { spawnGibBurst } from "../../death/gibBurst.js";
import { ScreenShakeBudget } from "../../particles/screenShake.js";
import { deathDecalInputs } from "../../death/deathDecalInputs.js";
import { KillZoomPunch } from "../camera/killZoomPunch.js";

export type { CarnageAppearance } from "../../death/deathCarnagePool.js";

export interface CombatEffectTarget {
  readonly x: number;
  readonly y: number;
  readonly groundHeight: number;
  readonly defId?: string | undefined;
  readonly nowMs: number;
}

export interface BloodHitInput extends CombatEffectTarget {
  readonly direction?: { x: number; y: number } | undefined;
}

export interface DeathGoreInput extends CombatEffectTarget {
  readonly appearance?: CarnageAppearance | undefined;
  readonly spritePrefix?: string | undefined;
  readonly impactAngle?: number | undefined;
}

export class CombatEffects {
  private readonly shake: ScreenShakeBudget;
  private readonly killZoomPunch: KillZoomPunch;
  private readonly bloodDecals: BloodDecalPool;
  private readonly corpseDecals: CorpseDecalPool;
  private readonly deathCarnage: DeathCarnagePool;

  constructor(private readonly scene: Phaser.Scene) {
    this.shake = new ScreenShakeBudget(scene.cameras.main);
    this.killZoomPunch = new KillZoomPunch(scene.cameras.main);
    this.bloodDecals = new BloodDecalPool(scene);
    this.corpseDecals = new CorpseDecalPool(scene);
    this.deathCarnage = new DeathCarnagePool(scene);
  }

  spawnBloodHit({ x, y, groundHeight, defId, nowMs, direction }: BloodHitInput): void {
    const settings = loadCarnageSettings();
    const screen = worldToScreen(x, y);
    if (isSkeletalDefId(defId)) {
      spawnBoneChipBurst(this.scene, { ...screen, lethal: false, direction });
      return;
    }
    if (!settings.bloodEnabled) return;
    const tint = bloodTintFor(defId);
    spawnHitSplatter(this.scene, { ...screen, tint, direction, intensity: settings.bloodDropIntensity });
    for (let index = 0; index < 3; index++) {
      this.bloodDecals.spawn({ x, y, groundHeight, tint, nowMs });
    }
  }

  spawnBloodDeath({ x, y, groundHeight, defId, nowMs }: CombatEffectTarget): void {
    const settings = loadCarnageSettings();
    const screen = worldToScreen(x, y);
    if (isSkeletalDefId(defId)) {
      spawnBoneChipBurst(this.scene, { ...screen, lethal: true });
      return;
    }
    if (!settings.bloodEnabled) return;
    const tint = bloodTintFor(defId);
    spawnDeathSplatter(this.scene, { ...screen, tint, intensity: settings.bloodDropIntensity });
    for (let index = 0; index < 12; index++) {
      this.bloodDecals.spawn({ x, y, groundHeight, tint, nowMs });
    }
  }

  spawnDeathGore({
    x,
    y,
    groundHeight,
    defId,
    nowMs,
    appearance = {},
    spritePrefix,
    impactAngle,
  }: DeathGoreInput): void {
    const settings = loadCarnageSettings();
    const screen = worldToScreen(x, y);
    const tint = bloodTintFor(defId);
    this.spawnGibBurst({ screen, tint, defId, enabled: settings.enabled });
    this.spawnDeathDecals({
      input: { x, y, groundHeight, defId, nowMs, appearance, spritePrefix, impactAngle },
      tint,
      bloodEnabled: settings.bloodEnabled,
    });
  }

  spawnKillMoment(input: DeathGoreInput): void {
    this.spawnDeathGore(input);
    this.shake.onKillMoment(input.nowMs);
    this.killZoomPunch.trigger();
  }

  onOwnHit(nowMs: number): void {
    this.shake.onOwnHit(nowMs);
  }

  onOwnDeath(nowMs: number): void {
    this.shake.onOwnDeath(nowMs);
  }

  update(nowMs: number): void {
    this.bloodDecals.update(nowMs);
    this.corpseDecals.update(nowMs);
    this.deathCarnage.update(nowMs);
  }

  dispose(): void {
    this.bloodDecals.dispose();
    this.corpseDecals.dispose();
    this.deathCarnage.dispose();
  }

  private spawnGibBurst({ screen, tint, defId, enabled }: {
    readonly screen: { x: number; y: number };
    readonly tint: number;
    readonly defId?: string | undefined;
    readonly enabled: boolean;
  }): void {
    if (enabled && !isSkeletalDefId(defId)) spawnGibBurst(this.scene, { ...screen, tint });
  }

  private spawnDeathDecals({ input, tint, bloodEnabled }: {
    readonly input: DeathGoreInput;
    readonly tint: number;
    readonly bloodEnabled: boolean;
  }): void {
    const decals = deathDecalInputs({ input, tint, bloodEnabled });
    this.deathCarnage.spawn(decals.carnage);
    this.corpseDecals.spawn(decals.corpse);
  }
}
