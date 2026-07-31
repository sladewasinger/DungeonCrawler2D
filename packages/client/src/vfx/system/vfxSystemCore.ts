import type Phaser from "phaser";
import {
  DESKTOP_DEVICE_PRESENTATION_PROFILE,
  type DevicePresentationProfile,
} from "../../presentation/devicePresentationProfile.js";
import { worldToScreen } from "../../render/entities/geometry/worldToScreen.js";
import type { LightSource } from "../../render/lighting/core/lightSource.js";
import type { AreaTileView } from "../areas/areaEffectPool.js";
import { spawnFistbumpFlourish } from "../flourishes/fistbumpFlourish.js";
import { GraceRing } from "../overlays/status/graceRing.js";
import { lowHpVignetteAlpha } from "../overlays/status/lowHpVignette.js";
import { spawnPickupGlint } from "../particles/pickupGlint.js";
import { createVfxSystemComponents, type VfxSystemComponents } from "./vfxSystemComponents.js";
import type {
  DamageNumberVfxInput,
  MotionVfxInput,
  OutOfBreathVfxInput,
} from "./vfxSystemTypes.js";

export class VfxSystemCore {
  protected readonly components: VfxSystemComponents;
  protected readonly scene: Phaser.Scene;
  readonly graceRing: GraceRing;
  private selfHpRatio = 1;

  constructor(
    scene: Phaser.Scene,
    deviceProfile: DevicePresentationProfile = DESKTOP_DEVICE_PRESENTATION_PROFILE,
  ) {
    this.scene = scene;
    this.components = createVfxSystemComponents(scene, deviceProfile);
    this.graceRing = new GraceRing(scene);
  }

  syncAreas(tiles: readonly AreaTileView[]): LightSource[] {
    return this.components.areas.sync(tiles);
  }

  syncTorchFlames(torches: readonly LightSource[]): void {
    this.components.torchFlames.sync(torches);
  }

  trackPlayerMotion({ x, y, groundHeight, air, faceX, nowMs }: MotionVfxInput): void {
    this.components.playerMotionFx.track({ x, y, groundHeight, air, faceX }, nowMs);
  }

  syncOutOfBreath(input: OutOfBreathVfxInput): void {
    this.components.outOfBreathFx.sync(input);
  }

  spawnDamageNumber({ x, y, feedback, nowMs }: DamageNumberVfxInput): void {
    this.components.damageNumbers.spawn({ ...worldToScreen(x, y), feedback, nowMs });
  }

  spawnPickupGlint(worldX: number, worldY: number): void {
    const screen = worldToScreen(worldX, worldY);
    spawnPickupGlint(this.scene, screen.x, screen.y);
  }

  spawnFistbumpFlourish(worldX: number, worldY: number): void {
    const screen = worldToScreen(worldX, worldY - 1.3);
    spawnFistbumpFlourish(this.scene, screen.x, screen.y);
  }

  setSelfHp(hp: number, maxHp: number): void {
    this.selfHpRatio = maxHp > 0 ? Math.max(0, hp) / maxHp : 0;
  }

  update(nowMs: number): void {
    this.components.damageNumbers.update(nowMs);
    this.components.xpNumbers.update(nowMs);
    this.components.meleeSwingFx.update(nowMs);
    this.components.wallBumpFx.update(nowMs);
    this.components.combat.update(nowMs);
    this.components.levelUpFlourish.update(nowMs);
    this.components.lowHpOverlay.update(lowHpVignetteAlpha(this.selfHpRatio, nowMs));
    this.components.floorBanner.update(nowMs);
    this.components.bossDownFlourish.update(nowMs);
    this.components.teleportFade.update(nowMs);
  }

  dispose(): void {
    this.components.areas.dispose();
    this.components.torchFlames.dispose();
    this.components.damageNumbers.dispose();
    this.components.xpNumbers.dispose();
    this.components.meleeSwingFx.dispose();
    this.components.wallBumpFx.dispose();
    this.components.combat.dispose();
    this.components.levelUpFlourish.dispose();
    this.components.lowHpOverlay.dispose();
    this.components.floorBanner.dispose();
    this.components.bossDownFlourish.dispose();
    this.components.teleportFade.dispose();
    this.graceRing.dispose();
    this.components.outOfBreathFx.dispose();
  }
}
