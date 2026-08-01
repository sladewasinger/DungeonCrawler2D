import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { InputController } from "../../../input/index.js";
import type { Connection } from "../../../net/connection/connection.js";
import type { HudFakeSnapshot } from "../../../ui/widgets/hud/core/fakeData.js";
import { VfxSystem } from "../../../vfx/system/index.js";
import type { World } from "@dc2d/engine";
import { EntityRenderer } from "../../../render/entities/geometry/index.js";
import { TerrainRenderer, type TerrainRendererLike } from "../../../render/terrain/index.js";
import { LightingSystem } from "../../../render/lighting/index.js";
import { terrainDeviceProfileForScene, type TerrainDeviceProfile } from "../../../render/terrain/streaming/terrainDeviceProfile.js";
import { devicePresentationProfileForKind } from "../../../presentation/devicePresentationProfile.js";
import { requestCameraSnap, stepCameraFollow } from "../camera/cameraFollow.js";
import type { RenderPose } from "./state.js";
import { worldToScreen } from "../../../render/entities/geometry/worldToScreen.js";
import type { HudScene } from "../../HudScene.js";
import { consumeFixedSteps } from "./fixedStep.js";
import { createInputPanels } from "../input/panelAdapters.js";
import { buildSocialHooks } from "../input/socialWiring.js";
import { resolveMouseAimHeading } from "../camera/mouseAimHeading.js";
import { createInputConnectionAdapter, createInputHooks, createInputQueries } from "../input/inputAdapters.js";
import type { ChatController } from "../../../ui/chat/controller.js";
import type { ChatInputBox } from "../../../ui/chat/chatInput.js";
import type { InteractionPrompt } from "../world/interactionPrompt.js";
import { LiveHudSnapshotCache } from "../hud/liveHudSnapshotCache.js";
import { trackWallBump } from "../combat/wallBumpTracking.js";
import { updateSelfFacing, type SelfCosmeticsState } from "../player/selfCosmetics.js";
import type { DungeonSceneState } from "./state.js";
import type { RotationController } from "../camera/rotationControl.js";
import type { CameraZoomEffectPort } from "../camera/viewport/cameraZoomController.js";

interface InputControllerRequest { readonly scene: Phaser.Scene; readonly conn: Connection; readonly hudScene: HudScene; readonly cosmetics: SelfCosmeticsState; readonly chatInputBox: ChatInputBox; }

export function buildDungeonInputController(request: InputControllerRequest): InputController {
  const { scene, conn, hudScene, cosmetics, chatInputBox } = request;
  const queries = createInputQueries(conn);
  return new InputController({ scene, conn: createInputConnectionAdapter(conn), panels: createInputPanels(hudScene, queries), hud: hudScene, queries, hooks: createInputHooks(cosmetics, buildSocialHooks(hudScene, chatInputBox)), tilePx: SCREEN_TILE_PX });
}

interface SampleDungeonInputRequest { readonly conn: Connection; readonly state: DungeonSceneState; readonly inputController: InputController; readonly vfx: VfxSystem; readonly deltaMs: number; readonly nowMs: number; }

export function sampleDungeonInput(request: SampleDungeonInputRequest): void {
  const { conn, state, inputController, vfx, deltaMs, nowMs } = request;
  const fixed = consumeFixedSteps(state.accumulatorMs, deltaMs);
  state.accumulatorMs = fixed.accumulatorMs;
  const move = inputController.readInput();
  state.renderInput = move;
  for (let index = 0; index < fixed.steps; index += 1) {
    const body = conn.body;
    updateSelfFacing(state.cosmetics, move);
    conn.sampleInput(move);
    trackWallBump({ conn, state, vfx, move, previousPosition: { x: body?.x ?? 0, y: body?.y ?? 0 }, nowMs });
  }
}

interface BuildHudSnapshotRequest {
  readonly scene: Phaser.Scene;
  readonly conn: Connection;
  readonly inputController: InputController;
  readonly interactionPrompt: InteractionPrompt | null;
  readonly chatController: ChatController;
  readonly cache: LiveHudSnapshotCache;
  readonly rotation: RotationController;
}

export function buildDungeonHudSnapshot(request: BuildHudSnapshotRequest): HudFakeSnapshot {
  const { scene, conn, inputController, interactionPrompt, chatController, cache, rotation } = request;
  return cache.build({
    conn, input: inputController, interactionPrompt, chat: chatController, actualFps: 1000 / scene.game.loop.delta,
    compassBearingDeg: rotation.bearingDeg(),
    aimHeadingDeg: resolveMouseAimHeading({ camera: scene.cameras.main, pointer: scene.input.activePointer, tilePx: SCREEN_TILE_PX, body: conn.body, heightAt: (x, y) => conn.world?.heightAt(x, y) ?? 0 }),
  });
}

interface WorldSystems { readonly terrain: TerrainRendererLike; readonly lighting: LightingSystem; }

export interface DungeonPresentationSystems {
  readonly deviceProfile: TerrainDeviceProfile;
  readonly entityRenderer: EntityRenderer;
  readonly vfx: VfxSystem;
}

export function createDungeonPresentationSystems(
  scene: Phaser.Scene,
  cameraZoom?: CameraZoomEffectPort,
): DungeonPresentationSystems {
  const deviceProfile = terrainDeviceProfileForScene(scene);
  const presentationProfile = devicePresentationProfileForKind(deviceProfile.kind);
  return {
    deviceProfile,
    entityRenderer: new EntityRenderer(scene, presentationProfile),
    vfx: new VfxSystem(scene, presentationProfile, cameraZoom),
  };
}

interface ReplaceWorldSystemsRequest { readonly scene: Phaser.Scene; readonly current: World | undefined; readonly terrain: TerrainRendererLike | undefined; readonly lighting: LightingSystem | undefined; readonly world: World; readonly deviceProfile: TerrainDeviceProfile; }

export function replaceDungeonWorldSystems(request: ReplaceWorldSystemsRequest): WorldSystems | undefined {
  const { scene, current, terrain, lighting, world, deviceProfile } = request;
  if (current === world) return undefined;
  terrain?.dispose();
  lighting?.dispose();
  return {
    terrain: new TerrainRenderer(scene, world, deviceProfile),
    lighting: new LightingSystem(scene, world, deviceProfile),
  };
}

interface AdvanceRotationRequest { readonly rotation: RotationController; readonly terrain: TerrainRendererLike | undefined; readonly lighting: LightingSystem | undefined; readonly state: DungeonSceneState; readonly deltaMs: number; }

export function advanceDungeonRotation({ rotation, terrain, lighting, state, deltaMs }: AdvanceRotationRequest): void {
  rotation.update(deltaMs, () => { terrain?.rebakeAllNow(); lighting?.invalidateAll(); requestCameraSnap(state.camera); });
}

interface UpdateCameraRequest { readonly scene: Phaser.Scene; readonly state: DungeonSceneState; readonly render: RenderPose; readonly deltaMs: number; }

export function updateDungeonCamera({ scene, state, render, deltaMs }: UpdateCameraRequest): void {
  const screen = worldToScreen(render.x, render.y);
  stepCameraFollow(state.camera, { targetX: screen.x, targetY: screen.y, deltaMs });
  scene.cameras.main.centerOn(state.camera.x, state.camera.y);
}

interface WorldPresentationRequest {
  readonly scene: Phaser.Scene;
  readonly terrain: TerrainRendererLike | undefined;
  readonly lighting: LightingSystem | undefined;
  readonly personal: RenderPose;
  readonly nowMs: number;
  readonly cameraRotationRad: number;
}

export function syncDungeonWorldPresentation(
  request: WorldPresentationRequest,
): void {
  const { scene, terrain, lighting, personal, nowMs } = request;
  scene.cameras.main.setRotation(request.cameraRotationRad);
  lighting?.prepareToonVisibility({
    view: scene.cameras.main.worldView,
    personal,
    nowMs,
    cameraRotationRad: request.cameraRotationRad,
  });
  terrain?.setWorldVisibility?.(lighting?.presentationVisibility() ?? null);
  terrain?.update(scene.cameras.main.worldView);
}

interface ConsumeTeleportRequest { readonly conn: Connection; readonly state: DungeonSceneState; readonly vfx: VfxSystem; readonly nowMs: number; }

export function consumeDungeonTeleport({ conn, state, vfx, nowMs }: ConsumeTeleportRequest): void {
  if (!conn.teleported) return;
  conn.teleported = false; state.accumulatorMs = 0; requestCameraSnap(state.camera); vfx.spawnTeleportFade(nowMs);
}
