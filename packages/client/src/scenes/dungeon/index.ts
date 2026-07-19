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
import type { HudFakeSnapshot } from "../../ui/widgets/hud/fakeData.js";
import { VfxSystem } from "../../vfx/index.js";
import type { HudScene } from "../HudScene.js";
import { buildAreaTileViews } from "./areaViews.js";
import { requestCameraSnap, stepCameraFollow } from "./cameraFollow.js";
import { buildRenderContext, itemView, monsterView, projectileView, remotePlayerView, selfPlayerView } from "./entityViews.js";
import { consumeFixedSteps, interpolationAlpha, lerp } from "./fixedStep.js";
import { buildHudSnapshot, type HudSnapshotSource } from "./hudSnapshot.js";
import { createHudActions, createInputConnectionAdapter, createInputHooks, createInputPanels, createInputQueries } from "./inputAdapters.js";
import { resolveInteractionPrompt, type InteractionPrompt } from "./interactionPrompt.js";
import { resolveMeleeSwings } from "./meleeSwingEvents.js";
import { pruneProjectileVelocity } from "./projectileVelocity.js";
import { resolveSelfAimAngle } from "./selfAim.js";
import { updateSelfFacing } from "./selfCosmetics.js";
import { createDungeonSceneState, type DungeonSceneState, type RenderPose } from "./state.js";

/** Remote entities render this far in the past, lerped between snapshot samples. */
const INTERP_DELAY_MS = 100;

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

  constructor(private readonly conn: Connection) {
    super("dungeon");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#14141c");
    this.cameras.main.setRoundPixels(true);
    this.entityRenderer = new EntityRenderer(this);
    this.vfx = new VfxSystem(this);
    this.hudScene = this.scene.get("hud") as HudScene;
    this.inputController = this.buildInputController();
    this.scene.launch("hud", { source: () => this.buildHudSnapshotNow(), actions: createHudActions(this.conn) });
    this.setUpCameraResize();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
  }

  update(time: number, deltaMs: number): void {
    const { conn } = this;
    if (!conn.world || !conn.body || !conn.welcome) return;

    this.ensureWorldBoundSystems(conn.world);
    this.consumeTeleport();
    // Sample+predict before interpolating so this frame's render reflects any tick(s)
    // that occurred this frame (matches reference/client's proven fixed-step order).
    this.sampleFixedStepInput(deltaMs);

    const render = this.interpolateSelfPose();
    this.updateCameraFollow(render, deltaMs);
    this.terrain?.update(this.cameras.main.worldView);
    this.partyIds = new Set((conn.party?.members ?? []).map((m) => m.id));

    this.syncEntities(time, deltaMs / 1000, render);
    this.syncLightingAndVfx(time, render);
  }

  private buildInputController(): InputController {
    const connAdapter = createInputConnectionAdapter(this.conn);
    const panels = createInputPanels(this.hudScene);
    const queries = createInputQueries(this.conn);
    const hooks = createInputHooks(this.state.cosmetics, () => this.hudScene.toggleChat(), () => this.hudScene.toggleInventory());
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

  /** Server-flagged teleport (welcome, respawn, debug tp): reset local render state and snap the camera. */
  private consumeTeleport(): void {
    if (!this.conn.teleported) return;
    this.conn.teleported = false;
    this.state.prevStep = null;
    this.state.accumulatorMs = 0;
    requestCameraSnap(this.state.camera);
  }

  private sampleFixedStepInput(deltaMs: number): void {
    const { conn, state } = this;
    const { steps, accumulatorMs } = consumeFixedSteps(state.accumulatorMs, deltaMs);
    state.accumulatorMs = accumulatorMs;
    for (let i = 0; i < steps; i++) {
      const body = conn.body;
      if (body) state.prevStep = { x: body.x, y: body.y, z: body.z };
      const move = this.inputController.readInput();
      updateSelfFacing(state.cosmetics, move.moveX, move.moveY);
      conn.sampleInput(move);
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

  private syncEntities(nowMs: number, dtSeconds: number, render: RenderPose): void {
    const conn = this.conn;
    if (!conn.world || !conn.welcome || !conn.body) return;
    const interpolated = conn.interpolated(INTERP_DELAY_MS);
    const items = interpolated.filter((e) => e.snap.kind === "item");
    const context = buildRenderContext(conn.world, nowMs, dtSeconds, render.x, render.y, this.partyIds);

    const touchActive = this.inputController.touchVisual() !== null;
    const aimAngle = resolveSelfAimAngle(touchActive, this.state.cosmetics.faceX, this.state.cosmetics.faceY, render, this.cameras.main, this.input.activePointer);
    const self = selfPlayerView(
      { id: conn.welcome.playerId, name: conn.name, x: render.x, y: render.y, z: render.z, air: !conn.body.grounded },
      { hp: conn.hp, maxHp: conn.maxHp, fx: conn.fx, downed: conn.downed, weaponId: conn.weapon },
      this.state.cosmetics,
      nowMs,
      aimAngle,
    );
    const players = interpolated.filter((e) => e.snap.kind === "player").map(remotePlayerView);
    const allPlayers = [self, ...players];
    this.entityRenderer.syncPlayers(allPlayers, context);
    this.entityRenderer.syncMonsters(interpolated.filter((e) => e.snap.kind === "enemy").map(monsterView), context);
    this.entityRenderer.syncItems(items.map(itemView), nowMs);
    // Wedge telegraph for every player whose attack just started this frame (self or remote alike).
    for (const swing of resolveMeleeSwings(allPlayers, this.state.attackFlags)) {
      this.vfx.spawnMeleeSwing(swing.id, swing.worldX, swing.worldY, swing.angleRad, swing.depth, SCREEN_TILE_PX, nowMs);
    }

    const projectiles = interpolated.filter((e) => e.snap.kind === "projectile");
    this.entityRenderer.syncProjectiles(projectiles.map((e) => projectileView(e, this.state.projectileVelocity, nowMs)));
    pruneProjectileVelocity(this.state.projectileVelocity, new Set(projectiles.map((e) => e.id)));

    this.interactionPrompt = resolveInteractionPrompt(conn.world, render.x, render.y, items);
  }

  private syncLightingAndVfx(nowMs: number, render: RenderPose): void {
    const conn = this.conn;
    if (!this.lighting || !conn.body) return;
    const areaLights = this.vfx.syncAreas(buildAreaTileViews(conn.areaTiles));
    this.lighting.setAccentLights(areaLights);
    this.lighting.update(this.cameras.main.worldView, render.x, render.y, nowMs);
    this.vfx.syncTorchFlames(this.lighting.activeTorches());
    this.vfx.trackPlayerMotion(
      { x: render.x, y: render.y, air: !conn.body.grounded, faceX: this.state.cosmetics.faceX },
      nowMs,
    );
    this.applyVisualEvents(render, nowMs);
    this.vfx.update(nowMs);
  }

  /** Hit/death events are visual-only by the time they reach here (apply.ts routes outcome-bearing events elsewhere). */
  private applyVisualEvents(render: RenderPose, nowMs: number): void {
    const conn = this.conn;
    const selfId = conn.welcome?.playerId;
    for (const event of conn.drainVisualEvents()) {
      if (event.t === "hit") {
        const pos = event.id === selfId ? render : conn.entities.get(event.id)?.snap;
        if (pos) this.vfx.spawnDamageNumber(pos.x, pos.y - 0.6, event.amount, nowMs);
        if (event.id === selfId) this.vfx.onOwnHit(nowMs);
      } else if (event.t === "death" && event.id === selfId) {
        this.vfx.onOwnDeath(nowMs);
      }
    }
  }

  private buildHudSnapshotNow(): HudFakeSnapshot {
    const conn = this.conn;
    const source: HudSnapshotSource = {
      hp: conn.hp,
      maxHp: conn.maxHp,
      hotbar: conn.hotbar,
      inventory: conn.inventory,
      weapon: conn.weapon,
      fx: conn.fx,
      chatLog: conn.chatLog,
      hasParty: !!conn.party,
      pingMs: conn.rttMs,
      connected: conn.status === "connected",
      reconnecting: conn.status !== "connected",
      downed: conn.downed || conn.dead,
    };
    // conn.body may still be null the first frame or two after boot (HudScene's source()
    // callback runs every frame regardless of DungeonScene's own !conn.body update() guard).
    const bodyPos = conn.body ? { x: conn.body.x, y: conn.body.y } : { x: 0, y: 0 };
    const touch = this.inputController.touchVisual();
    return buildHudSnapshot(source, this.inputController.armedThrowableSlot(), this.interactionPrompt, touch, this.game.loop.actualFps, bodyPos);
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
  }
}
