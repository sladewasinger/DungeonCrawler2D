import type { World } from "@dc2d/engine";
import Phaser from "phaser";
import type { Connection } from "../net/connection/connection.js";
import { EntityRenderer } from "../render/entities/geometry/index.js";
import { LightingSystem } from "../render/lighting/index.js";
import type { TerrainRendererLike } from "../render/terrain/index.js";
import type { TerrainDeviceProfile } from "../render/terrain/streaming/terrainDeviceProfile.js";
import { TERRAIN_CAMERA_BACKGROUND } from "../render/terrain/runtime/renderSupport.js";
import { VfxSystem } from "../vfx/system/index.js";
import { DEFAULT_CAMERA_ZOOM } from "../scenes/dungeon/camera/cameraDefaults.js";
import { bindDungeonCameraResize } from "../scenes/dungeon/camera/cameraResize.js";
import { createTorchSyncState } from "../scenes/dungeon/entities/torches/sync.js";
import {
  createDungeonPresentationSystems,
  replaceDungeonWorldSystems,
} from "../scenes/dungeon/orchestration/dungeonSceneHelpers.js";
import { createDungeonSceneState } from "../scenes/dungeon/orchestration/state.js";
import { SpectatorCameraTracking } from "./camera/spectatorCameraTracking.js";
import {
  nextSpectatorCameraZoom,
  type SpectatorCameraZoomDirection,
} from "./camera/spectatorCameraZoom.js";
import { syncSpectatorCosmetics } from "./spectatorCosmetics.js";
import {
  spectatorTargetFrame,
  syncSpectatorFrame,
} from "./spectatorFrame.js";
import { SpectatorHud } from "./spectatorHud.js";
import { SpectatorTargetInterpolation } from "./spectatorTargetInterpolation.js";

export class SpectatorScene extends Phaser.Scene {
  private readonly state = createDungeonSceneState();
  private readonly partyIds = new Set<string>();
  private readonly torchSyncState = createTorchSyncState();
  private readonly targetInterpolation = new SpectatorTargetInterpolation();
  private entityRenderer!: EntityRenderer;
  private vfx!: VfxSystem;
  private deviceProfile!: TerrainDeviceProfile;
  private terrain: TerrainRendererLike | undefined;
  private lighting: LightingSystem | undefined;
  private boundWorld: World | undefined;
  private spectatorCamera!: SpectatorCameraTracking;
  private hud: SpectatorHud | undefined;
  private hudVisible: boolean;

  constructor(
    private readonly connection: Connection,
    hudVisible: boolean,
  ) {
    super("spectator-dungeon");
    this.hudVisible = hudVisible;
  }

  create(): void {
    const camera = this.cameras.main;
    camera.setBackgroundColor(TERRAIN_CAMERA_BACKGROUND);
    camera.setZoom(DEFAULT_CAMERA_ZOOM);
    camera.setRoundPixels(true);
    const presentation = createDungeonPresentationSystems(this);
    this.deviceProfile = presentation.deviceProfile;
    this.entityRenderer = presentation.entityRenderer;
    this.vfx = presentation.vfx;
    this.spectatorCamera = new SpectatorCameraTracking(this.game.canvas);
    const root = document.getElementById("app");
    if (root) this.hud = new SpectatorHud(root, this.connection);
    this.hud?.setVisible(this.hudVisible);
    bindDungeonCameraResize(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
  }

  update(time: number, deltaMs: number): void {
    const { connection } = this;
    const frame = spectatorTargetFrame({
      connection,
      interpolation: this.targetInterpolation,
      state: this.state,
      vfx: this.vfx,
      nowMs: time,
    });
    if (!frame || !connection.world) return;
    this.ensureWorldSystems(connection.world);
    syncSpectatorCosmetics(this.state, connection, time);
    const center = this.spectatorCamera.update({
      connection,
      render: frame.render,
      deltaMs,
      teleported: frame.teleported,
    });
    this.cameras.main.centerOn(center.x, center.y);
    syncSpectatorFrame({
      scene: this,
      connection,
      terrain: this.terrain,
      lighting: this.lighting,
      entityRenderer: this.entityRenderer,
      vfx: this.vfx,
      state: this.state,
      torchSyncState: this.torchSyncState,
      partyIds: this.partyIds,
      nowMs: time,
      deltaMs,
      render: frame.render,
      hud: this.hud,
    });
  }

  setHudVisible(visible: boolean): void {
    this.hudVisible = visible;
    this.hud?.setVisible(visible);
  }

  focusCamera(): void {
    this.spectatorCamera?.focus();
  }

  centerCamera(): void {
    this.spectatorCamera?.centerOnTarget();
  }

  zoomCamera(direction: SpectatorCameraZoomDirection): void {
    const camera = this.cameras.main;
    camera.setZoom(nextSpectatorCameraZoom(camera.zoom, direction));
    this.spectatorCamera?.focus();
  }

  private ensureWorldSystems(world: World): void {
    const systems = replaceDungeonWorldSystems({
      scene: this,
      current: this.boundWorld,
      terrain: this.terrain,
      lighting: this.lighting,
      world,
      deviceProfile: this.deviceProfile,
    });
    if (!systems) return;
    this.terrain = systems.terrain;
    this.lighting = systems.lighting;
    this.boundWorld = world;
  }

  private dispose(): void {
    this.spectatorCamera.dispose();
    this.hud?.dispose();
    this.terrain?.dispose();
    this.lighting?.dispose();
    this.entityRenderer.dispose();
    this.vfx.dispose();
  }
}
