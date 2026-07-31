// DungeonScene: orchestrates one live frame for the connected game — fixed-step
// predicted input, render interpolation, chunk-streamed terrain/lighting/entities/vfx,
// HUD widgets (driven live via the parallel "hud" scene), and an eased camera that
// snaps on teleport. Every subsystem's real logic lives in its own module; this file
// only sequences them in one readable order per frame.
import type { World } from "@dc2d/engine";
import Phaser from "phaser";
import { InputController } from "../../../input/index.js";
import type { Connection } from "../../../net/connection/connection.js";
import { EntityRenderer } from "../../../render/entities/geometry/index.js";
import { LightingSystem } from "../../../render/lighting/index.js";
import { TerrainRenderer, type TerrainRendererLike } from "../../../render/terrain/index.js";
import { TERRAIN_CAMERA_BACKGROUND } from "../../../render/terrain/runtime/renderSupport.js";
import type { TerrainDeviceProfile } from "../../../render/terrain/streaming/terrainDeviceProfile.js";
import { ChatController } from "../../../ui/chat/controller.js";
import type { ChatInputBox } from "../../../ui/chat/chatInput.js";
import { VfxSystem } from "../../../vfx/system/index.js";
import type { HudScene } from "../../HudScene.js";
import { requestCameraSnap } from "../camera/cameraFollow.js";
import { DEFAULT_CAMERA_ZOOM } from "../camera/cameraDefaults.js";
import { bindDungeonCameraResize } from "../camera/cameraResize.js";
import { InputGestureVisuals } from "../visuals/inputGestureVisuals.js";
import { syncFrame } from "../frame/frameSync.js";
import { createChatPort, createHudActions } from "../input/inputAdapters.js";
import { LiveHudSnapshotCache } from "../hud/liveHudSnapshotCache.js";
import { createCraftActions, createStashActions } from "../input/panelAdapters.js";
import { RotationController } from "../camera/rotationControl.js";
import { bindRotationKeys } from "../camera/rotationKeys.js";
import { createSessionActions } from "../input/sessionActions.js";
import { buildSocialActions } from "../input/socialWiring.js";
import type { InteractionPrompt } from "../world/interactionPrompt.js";
import { consumeRespawnGrace } from "../player/selfCosmetics.js";
import { interpolateConnectionSelf } from "../player/selfInterpolation.js";
import { createDungeonSceneState, type DungeonSceneState, type RenderPose } from "./state.js";
import { GameplayDebugOverlay } from "../../../render/debug/GameplayDebugOverlay.js";
import { createTorchSyncState, type TorchSyncState } from "../entities/torches/sync.js";
import { advanceDungeonRotation, buildDungeonHudSnapshot, buildDungeonInputController, consumeDungeonTeleport, createDungeonPresentationSystems, replaceDungeonWorldSystems, sampleDungeonInput, syncDungeonWorldPresentation, updateDungeonCamera } from "./dungeonSceneHelpers.js";
import { redirectExpiredSession } from "./expiredSessionRedirect.js";
import { createDungeonChatInputBox } from "./dungeonChatInput.js";

export class DungeonScene extends Phaser.Scene {
  private readonly state: DungeonSceneState = createDungeonSceneState();
  private entityRenderer!: EntityRenderer;
  private vfx!: VfxSystem;
  private inputController!: InputController;
  private hudScene!: HudScene;
  private terrain: TerrainRendererLike | undefined;
  private lighting: LightingSystem | undefined;
  private deviceProfile!: TerrainDeviceProfile;
  private boundWorld: World | undefined;
  private interactionPrompt: InteractionPrompt | null = null;
  private readonly partyIds = new Set<string>();
  private readonly torchSyncState: TorchSyncState = createTorchSyncState();
  private readonly hudSnapshotCache = new LiveHudSnapshotCache();
  private chatController!: ChatController;
  private chatInputBox!: ChatInputBox;
  private inputGestureVisuals!: InputGestureVisuals;
  private debugOverlay!: GameplayDebugOverlay;
  /** Z/X camera rotation: owns the tween, hard content swap, and cosmetic camera spin. */
  private readonly rotation = new RotationController((direction) => {
    const terrain = this.terrain as TerrainRenderer | undefined;
    terrain?.prewarmRotation(this.cameras.main.worldView, direction);
  });

  constructor(private readonly conn: Connection) { super("dungeon"); }

  create(): void {
    // Title text entry temporarily suspends Phaser capture; every dungeon entry
    // restores the gameplay keyboard contract for quit-to-title/rejoin cycles.
    this.input.keyboard?.enableGlobalCapture();
    this.game.canvas.tabIndex = -1; this.game.canvas.focus({ preventScroll: true });
    this.cameras.main.setBackgroundColor(TERRAIN_CAMERA_BACKGROUND); this.cameras.main.setZoom(DEFAULT_CAMERA_ZOOM);
    this.cameras.main.setRoundPixels(true);
    const presentation = createDungeonPresentationSystems(this);
    this.deviceProfile = presentation.deviceProfile; this.entityRenderer = presentation.entityRenderer; this.vfx = presentation.vfx;
    this.inputGestureVisuals = new InputGestureVisuals(this);
    this.debugOverlay = new GameplayDebugOverlay(this);
    this.hudScene = this.scene.get("hud") as HudScene;
    this.chatController = new ChatController(createChatPort(this.conn));
    this.chatInputBox = createDungeonChatInputBox({
      keyboard: this.input.keyboard,
      onSubmit: (text) => this.chatController.submit(text),
    });
    this.inputController = buildDungeonInputController({ scene: this, conn: this.conn, hudScene: this.hudScene, cosmetics: this.state.cosmetics, chatInputBox: this.chatInputBox });
    this.scene.launch("hud", {
      source: () => buildDungeonHudSnapshot({ scene: this, conn: this.conn, inputController: this.inputController, interactionPrompt: this.interactionPrompt, chatController: this.chatController, cache: this.hudSnapshotCache, rotation: this.rotation }), connection: this.conn,
      onSelectHotbar: (index: number | null) => this.inputController.setHotbarSlot(index), actions: createHudActions(this.conn),
      social: buildSocialActions({ chatController: this.chatController, box: this.chatInputBox, viewportHeight: () => this.scale.height, hudScene: this.hudScene }),
      stations: { craft: createCraftActions(this.conn), stash: createStashActions(this.conn) },
      session: createSessionActions(this, this.conn),
    });
    bindDungeonCameraResize(this);
    bindRotationKeys(this, this.rotation);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
  }

  update(time: number, deltaMs: number): void {
    const { conn } = this;
    // Reconnect retries gave up (net/socket.ts's MAX_RECONNECT_ATTEMPTS) — conn.world/
    // body/welcome are still the last-known stale state, not null, so this check must
    // run before the guard below or the scene would render a dead world forever
    // instead of a clean path back to title (Epic 7.12).
    if (redirectExpiredSession(this, conn)) return;
    this.chatController.sync();
    if (!conn.world || !conn.body || !conn.welcome) return this.inputGestureVisuals.hide();

    this.syncInputHolds(conn);
    this.prepareFrame(conn, time, deltaMs);
    // Sample+predict before interpolating so this frame's render reflects any tick(s)
    // that occurred this frame.
    sampleDungeonInput({ conn, state: this.state, inputController: this.inputController, vfx: this.vfx, deltaMs, nowMs: time });

    const render = interpolateConnectionSelf(conn, this.state, deltaMs);
    this.inputGestureVisuals.syncThrow(this.inputController, conn, render);
    conn.movementTrace?.recordFrame({
      time,
      input: this.state.renderInput,
      render,
      client: conn.movementTraceState(),
    });
    updateDungeonCamera({ scene: this, state: this.state, render, deltaMs }); syncDungeonWorldPresentation({ scene: this, terrain: this.terrain, lighting: this.lighting, personal: render, nowMs: time, cameraRotationRad: this.rotation.cameraRotationRad() });
    this.syncParty(conn);
    const synced = this.syncRenderFrame({ conn, time, deltaMs, render });
    this.debugOverlay.update({
      flags: conn.activeAdminDebugFlags,
      entities: conn.activeAdminDebugEntities,
      active: conn.activeAdmin,
      nowMs: time,
    });
    this.interactionPrompt = synced.interactionPrompt;
  }
  private syncInputHolds(conn: Connection): void {
    this.inputController.pollFistbumpHold();
    this.inputGestureVisuals.syncFistbump(this.inputController, conn);
    this.inputController.pollReviveHold();
    this.inputGestureVisuals.syncRevive(this.inputController, conn);
    this.inputController.pollGiveUpHold();
  }
  private prepareFrame(conn: Connection, time: number, deltaMs: number): void {
    this.ensureWorldBoundSystems(conn.world!); consumeDungeonTeleport({ conn, state: this.state, vfx: this.vfx, nowMs: time });
    this.consumeHardCorrection(); consumeRespawnGrace(conn, this.state.cosmetics, time);
    advanceDungeonRotation({ rotation: this.rotation, terrain: this.terrain, lighting: this.lighting, state: this.state, deltaMs });
  }
  private syncParty(conn: Connection): void {
    this.partyIds.clear(); for (const member of conn.party?.members ?? []) this.partyIds.add(member.id);
  }
  private syncRenderFrame({ conn, time, deltaMs, render }: { readonly conn: Connection; readonly time: number; readonly deltaMs: number; readonly render: RenderPose }) {
    return syncFrame({ scene: this, conn, entityRenderer: this.entityRenderer, vfx: this.vfx, terrain: this.terrain, lighting: this.lighting, inputController: this.inputController, state: this.state, torchSyncState: this.torchSyncState, partyIds: this.partyIds, nowMs: time, dtSeconds: deltaMs / 1000, render });
  }
  /** (Re)builds the World-bound renderers whenever Connection hands out a new World (initial connect or reconnect). */
  private ensureWorldBoundSystems(world: World): void {
    const systems = replaceDungeonWorldSystems({ scene: this, current: this.boundWorld, terrain: this.terrain, lighting: this.lighting, world, deviceProfile: this.deviceProfile });
    if (!systems) return;
    this.terrain = systems.terrain;
    this.lighting = systems.lighting;
    this.boundWorld = world;
  }
  /** Server-flagged teleport (welcome, respawn, debug tp, Epic 7.14 stairways once wired):
   * reset local render state, snap the camera, and fade through black over the cut. */
  private consumeHardCorrection(): void {
    if (!this.conn.predictionCorrection.consumeHardSnap()) return;
    requestCameraSnap(this.state.camera);
  }
  private dispose(): void {
    this.terrain?.dispose();
    this.lighting?.dispose();
    this.entityRenderer.dispose();
    this.vfx.dispose();
    this.chatInputBox.dispose();
    this.inputGestureVisuals.dispose();
    this.debugOverlay.dispose();
  }
}
