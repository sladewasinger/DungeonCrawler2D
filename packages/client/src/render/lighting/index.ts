// Lighting facade: atmosphere darkness, capped LOS-aware floor reveal, reusable fog,
// and colored halos. The work is bounded by device-profile budgets, never a shader.
import type { World } from "@dc2d/engine";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { getViewOrientation } from "../view/transform/viewState.js";
import { viewToWorld } from "../view/transform/viewTransform.js";
import {
  collectGroundRevealLights,
  collectTorchLights,
  selectFrameLights,
} from "./torches/frameLights.js";
import type { LightSource } from "./core/lightSource.js";
import { LightSpritePool } from "./core/pool.js";
import { GroundLightPass } from "./ground/groundLightPass.js";
import { readTerrainDeviceSignals, selectTerrainDeviceProfile } from "../terrain/streaming/terrainDeviceProfile.js";
import {
  MAXIMUM_ACTIVE_LIGHTS,
  createPersonalLight,
  type MutableLightSource,
} from "./lightingRuntimeStyle.js";
import { applyPlayerLightMode } from "./playerLightMode.js";
import {
  applyPlayerGroundLightAnchor,
  playerGroundLightAnchor,
  type PlayerGroundLightAnchorSource,
} from "./playerGroundLightAnchor.js";
import {
  lightingAtmosphereBudget,
  reducedMotionPreferred,
  type LightingAtmosphereBudget,
} from "./atmosphere/lightingAtmosphereBudget.js";
import { WorldLightStream } from "./worldLightStream.js";
import { LightingAtmosphere } from "./atmosphere/lightingAtmosphere.js";
import {
  lightingFrameState,
  type LightingFrame,
  type LightingFrameState,
} from "./lightingFrame.js";

export class LightingSystem {
  private readonly pool: LightSpritePool;
  private readonly groundLight: GroundLightPass;
  private readonly atmosphere: LightingAtmosphere;
  private readonly atmosphereBudget: LightingAtmosphereBudget;
  private personalHaloEnabled = false;
  private playerGroundRevealEnabled = true;
  private readonly worldLights: WorldLightStream;
  private accentLights: readonly LightSource[] = [];
  private readonly candidateLights: LightSource[] = [];
  private readonly frameLights: LightSource[] = [];
  private readonly revealWorldLights: LightSource[] = [];
  private readonly activeTorchLights: LightSource[] = [];
  private readonly personalLight: MutableLightSource = createPersonalLight();
  private carriesTorch = false;

  constructor(
    scene: Phaser.Scene,
    world: World,
  ) {
    this.pool = new LightSpritePool(scene);
    this.worldLights = new WorldLightStream(world);
    const profile = selectTerrainDeviceProfile(readTerrainDeviceSignals(scene));
    const reducedMotion = reducedMotionPreferred();
    this.atmosphereBudget = lightingAtmosphereBudget(profile.kind, reducedMotion);
    this.groundLight = new GroundLightPass(world);
    this.atmosphere = new LightingAtmosphere(
      scene,
      this.atmosphereBudget,
      reducedMotion,
    );
  }

  /** Extra colored lights the caller owns (area VFX, showcase set-pieces) — replaces the whole set each call. */
  setAccentLights(lights: readonly LightSource[]): void {
    this.accentLights = lights;
  }

  /** Compatibility toggle for diagnostics; it only controls the darkness-mask reveal. */
  setPlayerGroundLightEnabled(enabled: boolean): void {
    this.playerGroundRevealEnabled = enabled;
  }

  /** Streams chunk-scanned lights around the view, then syncs the halo pool for this frame. */
  update(input: LightingFrame): void {
    this.worldLights.update(input.view);
    this.updatePersonalLight(input.personal, input.carriesTorch);
    const frame = lightingFrameState(input);
    const lights = this.selectLights(input);
    const revealChanged = this.syncLightReveal(frame, input.nowMs, lights);
    this.atmosphere.update({
      enabled: !frame.insideRoom,
      overlayDepth: frame.overlayDepth,
      nowMs: input.nowMs,
      revealCells: this.groundLight.cellsForMask(),
      revealChanged,
    });
    this.pool.sync({ lights, nowMs: input.nowMs, overlayDepth: frame.overlayDepth });
  }

  private selectLights(input: LightingFrame): LightSource[] {
    // Cap anchors to what the CAMERA sees, never the personal anchor — a scene
    // viewed away from the player (gallery, spectate) must still keep its lights.
    // `view` is the camera's on-screen rect, which is in VIEW-pixel space once
    // worldToScreen routes through the seam — convert its center back to a REAL world
    // tile position before comparing against light.x/y, which stay real-world (torch/
    // door positions are scanned straight off the real world in scanChunk below).
    const centerView = { x: (input.view.x + input.view.width / 2) / SCREEN_TILE_PX, y: (input.view.y + input.view.height / 2) / SCREEN_TILE_PX };
    const centerWorld = viewToWorld(centerView, getViewOrientation());
    return selectFrameLights({
      chunkLights: this.worldLights.values(), accentLights: this.accentLights,
      center: centerWorld, personalLight: this.personalHaloEnabled ? this.personalLight : null,
      maxLights: MAXIMUM_ACTIVE_LIGHTS, candidates: this.candidateLights, selected: this.frameLights,
    });
  }

  private syncLightReveal(
    frame: LightingFrameState,
    nowMs: number,
    lights: readonly LightSource[],
  ): boolean {
    return this.groundLight.update({
      enabled: !frame.insideRoom && this.playerGroundRevealEnabled,
      nowMs,
      personal: this.personalLight,
      worldLights: collectGroundRevealLights(
        lights,
        this.atmosphereBudget.maximumRevealLights,
        this.revealWorldLights,
      ),
      maximumCells: this.atmosphereBudget.maximumRevealCells,
    });
  }

  /** Torch positions currently resident (authored wall torches + placed thrown
   * torches, fed in as accent lights) — vfx flame particles key off this list. */
  activeTorches(): readonly LightSource[] {
    return collectTorchLights(
      this.worldLights.values(),
      this.accentLights,
      this.activeTorchLights,
    );
  }

  /** Forces every chunk-scanned light (torch/door) to be re-derived — the lighting
   * sibling of TerrainRenderer.invalidateAll(), fired at the same live-rotation swap
   * instant since scanChunk's chunk footprint is also computed via the seam's
   * orientation-dependent viewChunkWorldOrigin. */
  invalidateAll(): void {
    this.worldLights.invalidate();
  }

  private updatePersonalLight(
    personal: PlayerGroundLightAnchorSource,
    carriesTorch: boolean,
  ): void {
    if (this.carriesTorch !== carriesTorch) this.groundLight.invalidate();
    this.carriesTorch = carriesTorch;
    this.personalHaloEnabled = carriesTorch;
    applyPlayerLightMode(this.personalLight, carriesTorch);
    applyPlayerGroundLightAnchor(
      this.personalLight,
      playerGroundLightAnchor(personal),
    );
  }

  dispose(): void {
    this.atmosphere.dispose();
    this.pool.dispose();
  }
}

export type { LightingFrame } from "./lightingFrame.js";
export type { LightKind, LightSource } from "./core/lightSource.js";
