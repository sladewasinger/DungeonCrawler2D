import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { InputController } from "../../input/index.js";
import type { Connection } from "../../net/connection.js";
import type { HudFakeSnapshot } from "../../ui/widgets/hud/fakeData.js";
import type { VfxSystem } from "../../vfx/index.js";
import type { World } from "@dc2d/engine";
import { Terrain4Renderer, type TerrainRendererLike } from "../../render/terrain4/index.js";
import { LightingSystem } from "../../render/lighting/index.js";
import { requestCameraSnap, stepCameraFollow } from "./cameraFollow.js";
import type { RenderPose } from "./state.js";
import { worldToScreen } from "../../render/entities/worldToScreen.js";
import type { HudScene } from "../HudScene.js";
import { consumeFixedSteps } from "./fixedStep.js";
import { createInputPanels } from "./panelAdapters.js";
import { buildSocialHooks } from "./socialWiring.js";
import { resolveMouseAimHeading } from "./mouseAimHeading.js";
import { createInputConnectionAdapter, createInputHooks, createInputQueries } from "./inputAdapters.js";
import type { ChatController } from "../../ui/chat/controller.js";
import type { ChatInputBox } from "../../ui/chat/chatInput.js";
import type { InteractionPrompt } from "./interactionPrompt.js";
import { LiveHudSnapshotCache } from "./liveHudSnapshotCache.js";
import { trackWallBump } from "./wallBumpTracking.js";
import { updateSelfFacing, type SelfCosmeticsState } from "./selfCosmetics.js";
import type { DungeonSceneState } from "./state.js";
import type { RotationController } from "./rotationControl.js";

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

interface ReplaceWorldSystemsRequest { readonly scene: Phaser.Scene; readonly current: World | undefined; readonly terrain: TerrainRendererLike | undefined; readonly lighting: LightingSystem | undefined; readonly world: World; }

export function replaceDungeonWorldSystems(request: ReplaceWorldSystemsRequest): WorldSystems | undefined {
  const { scene, current, terrain, lighting, world } = request;
  if (current === world) return undefined;
  terrain?.dispose(); lighting?.dispose();
  return { terrain: new Terrain4Renderer(scene, world), lighting: new LightingSystem(scene, world) };
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

interface ConsumeTeleportRequest { readonly conn: Connection; readonly state: DungeonSceneState; readonly vfx: VfxSystem; readonly nowMs: number; }

export function consumeDungeonTeleport({ conn, state, vfx, nowMs }: ConsumeTeleportRequest): void {
  if (!conn.teleported) return;
  conn.teleported = false; state.accumulatorMs = 0; requestCameraSnap(state.camera); vfx.spawnTeleportFade(nowMs);
}
