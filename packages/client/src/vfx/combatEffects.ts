import type Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import { BloodDecalPool } from "./bloodDecalPool.js";
import { spawnDeathSplatter, spawnHitSplatter } from "./bloodSplatter.js";
import { bloodTintFor } from "./bloodTint.js";
import { loadCarnageSettings } from "./carnageSettings.js";
import { CorpseDecalPool } from "./corpseDecalPool.js";
import { DeathCarnagePool, type CarnageAppearance } from "./deathCarnagePool.js";
import { spawnGibBurst } from "./gibBurst.js";
import { HIT_STOP_DURATION_MS, HIT_STOP_ZOOM } from "./hitStop.js";
import { ScreenShakeBudget } from "./screenShake.js";

export type { CarnageAppearance } from "./deathCarnagePool.js";

export class CombatEffects {
  private readonly shake: ScreenShakeBudget;
  private readonly bloodDecals: BloodDecalPool;
  private readonly corpseDecals: CorpseDecalPool;
  private readonly deathCarnage: DeathCarnagePool;

  constructor(private readonly scene: Phaser.Scene) {
    this.shake = new ScreenShakeBudget(scene.cameras.main);
    this.bloodDecals = new BloodDecalPool(scene);
    this.corpseDecals = new CorpseDecalPool(scene);
    this.deathCarnage = new DeathCarnagePool(scene);
  }

  spawnBloodHit(
    worldX: number,
    worldY: number,
    groundHeight: number,
    defId: string | undefined,
    nowMs: number,
    dirX?: number,
    dirY?: number,
  ): void {
    const settings = loadCarnageSettings();
    if (!settings.bloodEnabled) return;
    const screen = worldToScreen(worldX, worldY);
    const tint = bloodTintFor(defId);
    spawnHitSplatter(
      this.scene, screen.x, screen.y, tint, dirX, dirY,
      settings.bloodDropIntensity,
    );
    for (let index = 0; index < 3; index++) {
      this.bloodDecals.spawn(worldX, worldY, groundHeight, tint, nowMs);
    }
  }

  spawnBloodDeath(
    worldX: number,
    worldY: number,
    groundHeight: number,
    defId: string | undefined,
    nowMs: number,
  ): void {
    const settings = loadCarnageSettings();
    if (!settings.bloodEnabled) return;
    const screen = worldToScreen(worldX, worldY);
    const tint = bloodTintFor(defId);
    spawnDeathSplatter(
      this.scene, screen.x, screen.y, tint, settings.bloodDropIntensity,
    );
    for (let index = 0; index < 12; index++) {
      this.bloodDecals.spawn(worldX, worldY, groundHeight, tint, nowMs);
    }
  }

  spawnDeathGore(
    worldX: number,
    worldY: number,
    groundHeight: number,
    defId: string | undefined,
    nowMs: number,
    appearance: CarnageAppearance = {},
    spritePrefix?: string,
    impactAngle?: number,
  ): void {
    const settings = loadCarnageSettings();
    const screen = worldToScreen(worldX, worldY);
    const tint = bloodTintFor(defId);
    if (settings.enabled) {
      spawnGibBurst(this.scene, screen.x, screen.y, tint);
    }
    this.deathCarnage.spawn(
      worldX,
      worldY,
      groundHeight,
      tint,
      { ...appearance, ...(defId === undefined ? {} : { defId }) },
      nowMs,
      impactAngle,
      spritePrefix,
    );
    this.corpseDecals.spawn(
      worldX, worldY, groundHeight, tint, defId, nowMs,
      spritePrefix, settings.bloodEnabled,
    );
  }

  spawnKillMoment(
    worldX: number,
    worldY: number,
    groundHeight: number,
    defId: string | undefined,
    nowMs: number,
    appearance: CarnageAppearance = {},
    spritePrefix?: string,
    impactAngle?: number,
  ): void {
    this.spawnDeathGore(
      worldX, worldY, groundHeight, defId, nowMs,
      appearance, spritePrefix, impactAngle,
    );
    this.shake.onKillMoment(nowMs);
    this.punchCamera();
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

  private punchCamera(): void {
    const camera = this.scene.cameras.main;
    camera.zoomTo(HIT_STOP_ZOOM, HIT_STOP_DURATION_MS / 2, "Sine.easeOut", true, (_cam, progress) => {
      if (progress === 1) camera.zoomTo(1, HIT_STOP_DURATION_MS / 2, "Sine.easeIn");
    });
  }
}
