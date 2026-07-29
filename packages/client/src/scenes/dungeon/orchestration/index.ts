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
import { ChatController } from "../../../ui/chat/controller.js";
import { ChatInputBox } from "../../../ui/chat/chatInput.js";
import { VfxSystem } from "../../../vfx/system/index.js";
import type { HudScene } from "../../HudScene.js";
import { requestCameraSnap } from "../camera/cameraFollow.js";
import { DEFAULT_CAMERA_ZOOM } from "../camera/cameraDefaults.js";
import { bindDungeonCameraResize } from "../camera/cameraResize.js";
import { FistbumpRing } from "../visuals/fistbumpRing.js";
import { syncFistbumpRing } from "../visuals/fistbumpRingSync.js";
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
import { createTorchSyncState, type TorchSyncState } from "../entities/torchSync.js";
import { advanceDungeonRotation, buildDungeonHudSnapshot, buildDungeonInputController, consumeDungeonTeleport, replaceDungeonWorldSystems, sampleDungeonInput, updateDungeonCamera } from "./dungeonSceneHelpers.js";

export class DungeonScene extends Phaser.Scene {
  private readonly state: DungeonSceneState = createDungeonSceneState();
  private entityRenderer!: EntityRenderer;
  private vfx!: VfxSystem;
  private inputController!: InputController;
  private hudScene!: HudScene;
  private terrain: TerrainRendererLike | undefined;
  private lighting: LightingSystem | undefined;
  private boundWorld: World | undefined;
  private interactionPrompt: InteractionPrompt | null = null;
  private readonly partyIds = new Set<string>();
  private readonly torchSyncState: TorchSyncState = createTorchSyncState();
  private readonly hudSnapshotCache = new LiveHudSnapshotCache();
  private chatController!: ChatController;
  private chatInputBox!: ChatInputBox;
  private fistbumpRing!: FistbumpRing;
  /** LANE W2: Q/X camera rotation (see rotationControl.ts's doc comment for the Q/E-vs-Q/X
   * key deviation) — owns the tween + the hard content swap + the cosmetic camera spin. */
  private readonly rotation = new RotationController((direction) => {
    const terrain = this.terrain as TerrainRenderer | undefined;
    terrain?.prewarmRotation(this.cameras.main.worldView, direction);
  });

  constructor(private readonly conn: Connection) {
    super("dungeon");
  }

  create(): void {
    // Title text entry temporarily suspends Phaser capture; every dungeon entry
    // restores the gameplay keyboard contract for quit-to-title/rejoin cycles.
    this.input.keyboard?.enableGlobalCapture();
    this.game.canvas.tabIndex = -1; this.game.canvas.focus({ preventScroll: true });
    this.cameras.main.setBackgroundColor(TERRAIN_CAMERA_BACKGROUND); this.cameras.main.setZoom(DEFAULT_CAMERA_ZOOM);
    this.cameras.main.setRoundPixels(true);
    this.entityRenderer = new EntityRenderer(this);
    this.vfx = new VfxSystem(this);
    this.fistbumpRing = new FistbumpRing(this);
    this.hudScene = this.scene.get("hud") as HudScene;
    this.chatController = new ChatController(createChatPort(this.conn));
    this.chatInputBox = this.createChatInputBox();
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
    if (this.redirectExpiredSession()) return;
    this.chatController.sync();
    if (!conn.world || !conn.body || !conn.welcome) return;

    this.syncInputHolds(conn);
    this.prepareFrame(conn, time, deltaMs);
    // Sample+predict before interpolating so this frame's render reflects any tick(s)
    // that occurred this frame.
    sampleDungeonInput({ conn, state: this.state, inputController: this.inputController, vfx: this.vfx, deltaMs, nowMs: time });

    const render = interpolateConnectionSelf(conn, this.state, deltaMs);
    conn.movementTrace?.recordFrame({
      time,
      input: this.state.renderInput,
      render,
      client: conn.movementTraceState(),
    });
    updateDungeonCamera({ scene: this, state: this.state, render, deltaMs });
    this.syncTerrainAndParty(conn);
    const synced = this.syncRenderFrame({ conn, time, deltaMs, render });
    this.interactionPrompt = synced.interactionPrompt;
  }
  private createChatInputBox(): ChatInputBox {
    return new ChatInputBox({ onSubmit: (text) => this.chatController.submit(text), onFocusChange: (focused) => this.toggleKeyboardCapture(focused) });
  }
  private toggleKeyboardCapture(focused: boolean): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    if (focused) keyboard.disableGlobalCapture(); else keyboard.enableGlobalCapture();
  }
  private redirectExpiredSession(): boolean {
    if (!this.conn.sessionExpired) return false;
    this.conn.sessionExpired = false; this.scene.stop("hud"); this.scene.start("title", { expired: true });
    return true;
  }
  private syncInputHolds(conn: Connection): void {
    this.inputController.pollFistbumpHold(); syncFistbumpRing(this.fistbumpRing, this.inputController, conn);
    this.inputController.pollReviveHold(); this.inputController.pollGiveUpHold();
  }
  private prepareFrame(conn: Connection, time: number, deltaMs: number): void {
    this.ensureWorldBoundSystems(conn.world!); consumeDungeonTeleport({ conn, state: this.state, vfx: this.vfx, nowMs: time });
    this.consumeHardCorrection(); consumeRespawnGrace(conn, this.state.cosmetics, time);
    advanceDungeonRotation({ rotation: this.rotation, terrain: this.terrain, lighting: this.lighting, state: this.state, deltaMs });
  }
  private syncTerrainAndParty(conn: Connection): void {
    this.cameras.main.setRotation(this.rotation.cameraRotationRad()); this.terrain?.update(this.cameras.main.worldView);
    this.partyIds.clear(); for (const member of conn.party?.members ?? []) this.partyIds.add(member.id);
  }
  private syncRenderFrame({ conn, time, deltaMs, render }: { readonly conn: Connection; readonly time: number; readonly deltaMs: number; readonly render: RenderPose }) {
    return syncFrame({ scene: this, conn, entityRenderer: this.entityRenderer, vfx: this.vfx, terrain: this.terrain, lighting: this.lighting, inputController: this.inputController, state: this.state, torchSyncState: this.torchSyncState, partyIds: this.partyIds, nowMs: time, dtSeconds: deltaMs / 1000, render });
  }
  /** (Re)builds the World-bound renderers whenever Connection hands out a new World (initial connect or reconnect). */
  private ensureWorldBoundSystems(world: World): void {
    const systems = replaceDungeonWorldSystems({ scene: this, current: this.boundWorld, terrain: this.terrain, lighting: this.lighting, world });
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
    this.fistbumpRing.dispose();
  }
}
