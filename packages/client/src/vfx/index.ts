// VFX facade: owns every particle/juice subsystem and exposes the small trigger surface
// scenes call into — area hazards, torch flames, player motion feel, and combat juice.
import type Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import type { LightSource } from "../render/lighting/lightSource.js";
import { AreaEffectPool, type AreaTileView } from "./areaEffectPool.js";
import { DamageNumberPool } from "./damageNumbers.js";
import { spawnFistbumpFlourish } from "./fistbumpFlourish.js";
import { MeleeWedgePool } from "./meleeWedge.js";
import { spawnDustPuff, spawnFootstepMote } from "./movementParticles.js";
import { footstepDue, isMoving, motionEvents, type MotionSample } from "./motionFx.js";
import { spawnPickupGlint } from "./pickupGlint.js";
import { ScreenShakeBudget } from "./screenShake.js";
import { TorchFlamePool } from "./torchFlames.js";

export type { AreaSpriteKind, AreaTileView } from "./areaEffectPool.js";

export class VfxSystem {
  private readonly areas: AreaEffectPool;
  private readonly torchFlames: TorchFlamePool;
  private readonly damageNumbers: DamageNumberPool;
  private readonly meleeWedge: MeleeWedgePool;
  private readonly shake: ScreenShakeBudget;
  private lastPlayerSample: MotionSample | undefined;
  private lastFrameMs = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.areas = new AreaEffectPool(scene);
    this.torchFlames = new TorchFlamePool(scene);
    this.damageNumbers = new DamageNumberPool(scene);
    this.meleeWedge = new MeleeWedgePool(scene);
    this.shake = new ScreenShakeBudget(scene.cameras.main);
  }

  /** Rebuilds the active area-hazard rigs; returns their accent lights for LightingSystem.setAccentLights. */
  syncAreas(tiles: readonly AreaTileView[]): LightSource[] {
    return this.areas.sync(tiles);
  }

  syncTorchFlames(torches: readonly LightSource[]): void {
    this.torchFlames.sync(torches);
  }

  /** Feeds one frame of the tracked player's motion: fires dust/footstep edge triggers. */
  trackPlayerMotion(sample: MotionSample, nowMs: number): void {
    const prev = this.lastPlayerSample;
    const dt = (nowMs - this.lastFrameMs) / 1000;
    const moving = isMoving(prev, sample, dt);
    const events = motionEvents(prev, sample);
    this.fireMotionParticles(sample, events, moving, nowMs);
    this.lastPlayerSample = sample;
    this.lastFrameMs = nowMs;
  }

  private fireMotionParticles(sample: MotionSample, events: readonly string[], moving: boolean, nowMs: number): void {
    const screen = worldToScreen(sample.x, sample.y);
    if (events.includes("jumped") || events.includes("turned")) spawnDustPuff(this.scene, screen.x, screen.y, 5);
    if (events.includes("landed")) spawnDustPuff(this.scene, screen.x, screen.y, 8);
    if (footstepDue(this.lastFrameMs, nowMs, !sample.air, moving)) spawnFootstepMote(this.scene, screen.x, screen.y);
  }

  spawnDamageNumber(worldX: number, worldY: number, amount: number, nowMs: number, heal = false): void {
    const screen = worldToScreen(worldX, worldY);
    this.damageNumbers.spawn(screen.x, screen.y, amount, nowMs, heal);
  }

  spawnPickupGlint(worldX: number, worldY: number): void {
    const screen = worldToScreen(worldX, worldY);
    spawnPickupGlint(this.scene, screen.x, screen.y);
  }

  /** Fistbump-sealed success flourish (Epic 7.10) — call once per side, above their head. */
  spawnFistbumpFlourish(worldX: number, worldY: number): void {
    const screen = worldToScreen(worldX, worldY - 1.3);
    spawnFistbumpFlourish(this.scene, screen.x, screen.y);
  }

  /** Melee-arc swing telegraph, keyed by attacker id so a fresh swing reuses (redraws) that id's pooled Graphics rather than allocating a new one. */
  spawnMeleeSwing(id: string, worldX: number, worldY: number, angleRad: number, depth: number, tilePx: number, nowMs: number): void {
    this.meleeWedge.spawn(id, worldX, worldY, angleRad, depth, tilePx, nowMs);
  }

  onOwnHit(nowMs: number): void {
    this.shake.onOwnHit(nowMs);
  }

  onOwnDeath(nowMs: number): void {
    this.shake.onOwnDeath(nowMs);
  }

  /** Advances every per-frame subsystem (damage numbers rise/fade, wedge telegraphs fade). */
  update(nowMs: number): void {
    this.damageNumbers.update(nowMs);
    this.meleeWedge.update(nowMs);
  }

  dispose(): void {
    this.areas.dispose();
    this.torchFlames.dispose();
    this.damageNumbers.dispose();
    this.meleeWedge.dispose();
  }
}
