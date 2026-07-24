// DungeonScene: orchestrates one live frame for the connected game — fixed-step
// predicted input, render interpolation, chunk-streamed terrain/lighting/entities/vfx,
// HUD widgets (driven live via the parallel "hud" scene), and an eased camera that
// snaps on teleport. Every subsystem's real logic lives in its own module; this file
// only sequences them in one readable order per frame.
import type { World } from "@dc2d/engine";
import Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { InputController } from "../../input/index.js";
import type { Connection } from "../../net/connection.js";
import { EntityRenderer } from "../../render/entities/index.js";
import { worldToScreen } from "../../render/entities/worldToScreen.js";
import { LightingSystem } from "../../render/lighting/index.js";
import { TerrainRenderer } from "../../render/terrain/index.js";
import { ChatController } from "../../ui/chat/controller.js";
import { ChatInputBox } from "../../ui/chat/chatInput.js";
import type { HudFakeSnapshot } from "../../ui/widgets/hud/fakeData.js";
import { VfxSystem } from "../../vfx/index.js";
import type { HudScene } from "../HudScene.js";
import { requestCameraSnap, stepCameraFollow } from "./cameraFollow.js";
import { consumeFixedSteps, interpolationAlpha, lerp, translatePose } from "./fixedStep.js";
import { FistbumpRing } from "./fistbumpRing.js";
import { syncFistbumpRing } from "./fistbumpRingSync.js";
import { syncFrame } from "./frameSync.js";
import {
  createChatPort,
  createHudActions,
  createInputConnectionAdapter,
  createInputHooks,
  createInputQueries,
} from "./inputAdapters.js";
import { buildLiveHudSnapshot } from "./liveHudSnapshot.js";
import { createCraftActions, createInputPanels, createStashActions } from "./panelAdapters.js";
import { RotationController } from "./rotationControl.js";
import { bindRotationKeys } from "./rotationKeys.js";
import { syncReviveRing } from "./reviveRingSync.js";
import { buildSocialActions, buildSocialHooks } from "./socialWiring.js";
import type { InteractionPrompt } from "./interactionPrompt.js";
import { consumeRespawnGrace, updateSelfFacing } from "./selfCosmetics.js";
import { createDungeonSceneState, type DungeonSceneState, type RenderPose } from "./state.js";
import { createTorchSyncState, type TorchSyncState } from "./torchSync.js";
import { trackWallBump } from "./wallBumpTracking.js";

export class DungeonScene extends Phaser.Scene {
  private readonly state: DungeonSceneState = createDungeonSceneState();
  private entityRenderer!: EntityRenderer;
  private vfx!: VfxSystem;
  private inputController!: InputController;
  private hudScene!: HudScene;
  private terrain: TerrainRenderer | undefined;
  private lighting: LightingSystem | undefined;
  private boundWorld: World | undefined;
  private interactionPrompt: InteractionPrompt | null = null;
  private partyIds: ReadonlySet<string> = new Set();
  private readonly torchSyncState: TorchSyncState = createTorchSyncState();
  private chatController!: ChatController;
  private chatInputBox!: ChatInputBox;
  private fistbumpRing!: FistbumpRing;
  /** Same generic ring visual as fistbumpRing, driven by the hold-E revive gesture. */
  private reviveRing!: FistbumpRing;
  /** LANE W2: Q/X camera rotation (see rotationControl.ts's doc comment for the Q/E-vs-Q/X
   * key deviation) — owns the tween + the hard content swap + the cosmetic camera spin. */
  private readonly rotation = new RotationController();

  constructor(private readonly conn: Connection) {
    super("dungeon");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#14141c");
    this.cameras.main.setRoundPixels(true);
    this.entityRenderer = new EntityRenderer(this);
    this.vfx = new VfxSystem(this);
    this.fistbumpRing = new FistbumpRing(this);
    this.reviveRing = new FistbumpRing(this);
    this.hudScene = this.scene.get("hud") as HudScene;
    this.chatController = new ChatController(createChatPort(this.conn));
    this.chatInputBox = new ChatInputBox({
      onSubmit: (text) => this.chatController.submit(text),
      onFocusChange: (focused) => {
        const keyboard = this.input.keyboard;
        if (!keyboard) return;
        if (focused) keyboard.disableGlobalCapture();
        else keyboard.enableGlobalCapture();
      },
    });
    this.inputController = this.buildInputController();
    this.scene.launch("hud", {
      source: () => this.buildHudSnapshotNow(), connection: this.conn,
      onSelectHotbar: (index: number | null) => this.inputController.setHotbarSlot(index), actions: createHudActions(this.conn),
      social: buildSocialActions(this.chatController, this.chatInputBox, () => this.scale.height, this.hudScene),
      stations: { craft: createCraftActions(this.conn), stash: createStashActions(this.conn) },
    });
    this.setUpCameraResize();
    bindRotationKeys(this, this.rotation);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
  }

  update(time: number, deltaMs: number): void {
    const { conn } = this;
    // Reconnect retries gave up (net/socket.ts's MAX_RECONNECT_ATTEMPTS) — conn.world/
    // body/welcome are still the last-known stale state, not null, so this check must
    // run before the guard below or the scene would render a dead world forever
    // instead of a clean path back to title (Epic 7.12).
    if (conn.sessionExpired) {
      conn.sessionExpired = false;
      this.scene.stop("hud");
      this.scene.start("title", { expired: true });
      return;
    }
    this.chatController.sync();
    if (!conn.world || !conn.body || !conn.welcome) return;

    this.inputController.pollFistbumpHold();
    syncFistbumpRing(this.fistbumpRing, this.inputController, conn);
    this.inputController.pollReviveHold();
    this.inputController.pollGiveUpHold();
    syncReviveRing(this.reviveRing, this.inputController, conn);
    this.ensureWorldBoundSystems(conn.world);
    this.consumeTeleport(time);
    consumeRespawnGrace(conn, this.state.cosmetics, time);
    this.advanceRotation(deltaMs);
    this.state.prevStep = translatePose(this.state.prevStep, conn.predictionCorrection.consume());
    // Sample+predict before interpolating so this frame's render reflects any tick(s)
    // that occurred this frame (matches reference/client's proven fixed-step order).
    this.sampleFixedStepInput(deltaMs, time);

    const render = this.interpolateSelfPose();
    this.updateCameraFollow(render, deltaMs);
    this.cameras.main.setRotation(this.rotation.cameraRotationRad());
    this.terrain?.update(this.cameras.main.worldView);
    this.partyIds = new Set((conn.party?.members ?? []).map((m) => m.id));

    const synced = syncFrame(this, conn, this.entityRenderer, this.vfx, this.terrain, this.lighting, this.inputController, this.state, this.torchSyncState, this.partyIds, time, deltaMs / 1000, render);
    this.interactionPrompt = synced.interactionPrompt;
  }

  /** Advances the Q/X rotation tween BEFORE input is sampled, so camera-relative
   * movement this same frame already remaps against whatever orientation the tween's
   * one hard content swap (if this frame crosses the 45-degree midpoint) settles on. */
  private advanceRotation(deltaMs: number): void {
    this.rotation.update(deltaMs, () => {
      // rebakeAllNow, not invalidateAll: the snap must land with the whole view baked
      // in the same frame — the budgeted 2-chunks-per-frame stream made the world
      // blink in piecewise after every rotation (user playtest).
      this.terrain?.rebakeAllNow();
      this.lighting?.invalidateAll();
      // An orientation swap teleports the player's VIEW position, and the eased
      // follow would otherwise pan dozens of tiles from the old view coords back
      // to the player ("I'm literally off-screen after the rotation" — user).
      // The camera contract's own rule applies: snaps on teleport.
      requestCameraSnap(this.state.camera);
    });
  }

  private buildInputController(): InputController {
    const connAdapter = createInputConnectionAdapter(this.conn);
    const queries = createInputQueries(this.conn);
    const panels = createInputPanels(this.hudScene, queries);
    const hooks = createInputHooks(
      this.state.cosmetics,
      buildSocialHooks(this.hudScene, this.chatInputBox),
    );
    return new InputController(this, connAdapter, panels, this.hudScene, queries, hooks, SCREEN_TILE_PX);
  }

  /** (Re)builds the World-bound renderers whenever Connection hands out a new World (initial connect or reconnect). */
  private ensureWorldBoundSystems(world: World): void {
    if (this.boundWorld === world) return;
    this.terrain?.dispose();
    this.lighting?.dispose();
    this.terrain = new TerrainRenderer(this, world);
    this.lighting = new LightingSystem(this, world);
    this.boundWorld = world;
  }

  /** Server-flagged teleport (welcome, respawn, debug tp, Epic 7.14 stairways once wired):
   * reset local render state, snap the camera, and fade through black over the cut. */
  private consumeTeleport(nowMs: number): void {
    if (!this.conn.teleported) return;
    this.conn.teleported = false;
    this.state.prevStep = null;
    this.state.accumulatorMs = 0;
    requestCameraSnap(this.state.camera);
    this.vfx.spawnTeleportFade(nowMs);
  }

  private sampleFixedStepInput(deltaMs: number, nowMs: number): void {
    const { conn, state } = this;
    const { steps, accumulatorMs } = consumeFixedSteps(state.accumulatorMs, deltaMs);
    state.accumulatorMs = accumulatorMs;
    const move = this.inputController.readInput();
    for (let i = 0; i < steps; i++) {
      const body = conn.body;
      if (body) state.prevStep = { x: body.x, y: body.y, z: body.z };
      updateSelfFacing(state.cosmetics, move.moveX, move.moveY, move.jump);
      const preX = body?.x ?? 0;
      const preY = body?.y ?? 0;
      conn.sampleInput(move);
      // Panel round 3b item 4 (WALL-BUMP FEEDBACK) — see wallBumpTracking.ts's doc comment.
      trackWallBump(conn, state, this.vfx, move, preX, preY, nowMs);
    }
  }

  /** This frame's smoothed self pose: last tick's pre-step position lerped toward the current predicted body. */
  private interpolateSelfPose(): RenderPose {
    const body = this.conn.body;
    if (!body) return { x: 0, y: 0, z: 0 };
    const alpha = interpolationAlpha(this.state.accumulatorMs);
    const prev = this.state.prevStep ?? body;
    return { x: lerp(prev.x, body.x, alpha), y: lerp(prev.y, body.y, alpha), z: lerp(prev.z, body.z, alpha) };
  }

  private updateCameraFollow(render: RenderPose, deltaMs: number): void {
    const screen = worldToScreen(render.x, render.y);
    stepCameraFollow(this.state.camera, screen.x, screen.y, deltaMs);
    this.cameras.main.centerOn(this.state.camera.x, this.state.camera.y);
  }

  private buildHudSnapshotNow(): HudFakeSnapshot {
    return buildLiveHudSnapshot(
      this.conn,
      this.inputController,
      this.interactionPrompt,
      this.chatController,
      // Instantaneous rate, NOT loop.actualFps: that EMA is seeded at 60 and
      // converges over ~90s, which fabricated a "monotonic fps collapse" for
      // slow clients (judge-panel finding; connectionStatus does its own smoothing).
      1000 / this.game.loop.delta,
      this.rotation.bearingDeg(),
    );
  }

  private setUpCameraResize(): void {
    const onResize = (gameSize: Phaser.Structs.Size) => this.cameras.main.setSize(gameSize.width, gameSize.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  private dispose(): void {
    this.terrain?.dispose();
    this.lighting?.dispose();
    this.entityRenderer.dispose();
    this.vfx.dispose();
    this.chatInputBox.dispose();
    this.fistbumpRing.dispose();
    this.reviveRing.dispose();
  }
}
