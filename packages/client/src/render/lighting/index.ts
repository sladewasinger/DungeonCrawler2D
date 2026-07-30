// Lighting facade: the small dynamic layer over the BAKED tile lighting — a
// colored halo pool (torch flames, portals, and the constrained-device personal
// fallback) plus accent lights for live effects and camera post-FX. Ambient darkness
// lives in the baked tile tints now; there is no screen darkness overlay to maintain.
import type { World } from "@dc2d/engine";
import type Phaser from "phaser";
import type { ViewRect } from "../terrain/streaming/streaming.js";
import { collectTorchLights } from "./torches/frameLights.js";
import { syncClassicLightFrame } from "./core/classicLightFrame.js";
import type { LightSource } from "./core/lightSource.js";
import { LightSpritePool } from "./core/pool.js";
import { clearSoftLightPool } from "./core/softLightPool.js";
import { PlayerGroundLightPass } from "./ground/playerGroundLightPass.js";
import { playerGroundLightEnabledForProfile } from "./ground/playerGroundLight.js";
import {
  terrainDeviceProfileForScene,
  type TerrainDeviceProfile,
} from "../terrain/streaming/terrainDeviceProfile.js";
import { ChunkLightStream } from "./torches/chunkLightStream.js";
import { createPersonalLight, type MutableLightSource } from "./lightingRuntimeStyle.js";
import {
  readLightingToonMetrics,
  ToonVisibilityController,
  type LightingToonMetrics,
} from "./toon/index.js";
export class LightingSystem {
  private readonly pool: LightSpritePool;
  private readonly groundLight: PlayerGroundLightPass;
  private readonly toon: ToonVisibilityController;
  private playerGroundLightEnabled = true;
  private personalHaloEnabled = true;
  private readonly chunkLights: ChunkLightStream;
  private accentLights: readonly LightSource[] = [];
  private readonly candidateLights: LightSource[] = [];
  private readonly frameLights: LightSource[] = [];
  private readonly activeTorchLights: LightSource[] = [];
  private readonly personalLight: MutableLightSource = createPersonalLight();
  constructor(
    scene: Phaser.Scene,
    private readonly world: World,
    profile: TerrainDeviceProfile = terrainDeviceProfileForScene(scene),
  ) {
    this.pool = new LightSpritePool(scene);
    this.groundLight = new PlayerGroundLightPass(scene, world);
    this.toon = new ToonVisibilityController(scene, world);
    this.chunkLights = new ChunkLightStream(world, profile.lightLoadMarginChunks);
    this.setPlayerGroundLightEnabled(playerGroundLightEnabledForProfile(profile.kind));
  }
  /** Extra colored lights the caller owns (area VFX, showcase set-pieces) — replaces the whole set each call. */
  setAccentLights(lights: readonly LightSource[]): void {
    this.accentLights = lights;
  }
  /** Performance fallback: disabling the bounded floor pass restores the personal halo. */
  setPlayerGroundLightEnabled(enabled: boolean): void {
    this.playerGroundLightEnabled = enabled;
    this.syncPersonalLighting(false);
  }
  /** Runs before interpolation so the same LOS field can cull remote presentation. */
  prepareToonVisibility(input: LightingFrame): boolean {
    const active = this.toon.prepare(input);
    this.syncPersonalLighting(active);
    return active;
  }
  isToonVisible(x: number, y: number): boolean {
    return this.toon.isVisible(x, y);
  }

  isWorldPositionVisible(x: number, y: number): boolean {
    return this.toon.isWorldPositionVisible(x, y);
  }

  isToonActive(): boolean {
    return this.toon.isActive();
  }

  toonMetrics(): LightingToonMetrics {
    return readLightingToonMetrics(this.toon, this.groundLight.activeCellCount());
  }

  /** Streams chunk-scanned lights around the view, then syncs the halo pool for this frame. */
  update(input: LightingFrame): void {
    const toonActive = this.prepareToonVisibility(input);
    this.chunkLights.stream(input.view);
    this.updatePersonalLight(input.personal);
    if (toonActive) {
      clearSoftLightPool(this.pool, input.nowMs, input.view);
      return;
    }
    syncClassicLightFrame({
      pool: this.pool,
      groundLight: this.groundLight,
      view: input.view,
      personal: input.personal,
      personalLight: this.personalHaloEnabled ? this.personalLight : null,
      nowMs: input.nowMs,
      chunkLights: this.chunkLights.values(),
      accentLights: this.accentLights,
      candidates: this.candidateLights,
      selected: this.frameLights,
    });
  }

  /** Torch positions currently resident (authored wall torches + placed thrown
   * torches, fed in as accent lights) — vfx flame particles key off this list. */
  activeTorches(): readonly LightSource[] {
    return collectTorchLights(
      this.chunkLights.values(),
      this.accentLights,
      this.activeTorchLights,
    );
  }

  /** Forces every chunk-scanned light (torch/door) to be re-derived — the lighting
   * sibling of TerrainRenderer.invalidateAll(), fired at the same live-rotation swap
   * instant since scanChunk's chunk footprint is also computed via the seam's
   * orientation-dependent viewChunkWorldOrigin. */
  invalidateAll(): void {
    this.chunkLights.invalidate();
  }

  private updatePersonalLight(personal: Readonly<{ x: number; y: number }>): void {
    this.personalLight.x = personal.x;
    this.personalLight.y = personal.y;
    this.personalLight.groundHeight = this.world.groundAt(personal.x, personal.y);
  }

  private syncPersonalLighting(toonActive: boolean): void {
    const groundEnabled = this.playerGroundLightEnabled && !toonActive;
    this.groundLight.setEnabled(groundEnabled);
    this.personalHaloEnabled = !groundEnabled && !toonActive;
  }

  dispose(): void {
    this.toon.dispose();
    this.groundLight.dispose();
    this.pool.dispose();
  }
}

export interface LightingFrame {
  readonly view: ViewRect;
  readonly personal: Readonly<{ x: number; y: number }>;
  readonly nowMs: number;
}

export type { LightKind, LightSource } from "./core/lightSource.js";
