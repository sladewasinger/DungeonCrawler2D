import type Phaser from "phaser";
import type { Connection } from "../net/connection/connection.js";
import type { EntityRenderer } from "../render/entities/geometry/index.js";
import type { LightingSystem } from "../render/lighting/index.js";
import type { TerrainRendererLike } from "../render/terrain/index.js";
import type { TorchSyncState } from "../scenes/dungeon/entities/torches/sync.js";
import { syncFrame } from "../scenes/dungeon/frame/frameSync.js";
import { READ_ONLY_PRESENTATION_INPUT } from "../scenes/dungeon/frame/presentationInput.js";
import { syncDungeonWorldPresentation } from "../scenes/dungeon/orchestration/dungeonSceneHelpers.js";
import type {
  DungeonSceneState,
  RenderPose,
} from "../scenes/dungeon/orchestration/state.js";
import type { VfxSystem } from "../vfx/system/index.js";
import type { SpectatorHud } from "./spectatorHud.js";
import { consumeSpectatorTeleport } from "./spectatorTeleport.js";
import type { SpectatorTargetInterpolation } from "./spectatorTargetInterpolation.js";
import { spectatorPresentationDelay } from "./camera/spectatorPresentationTimeline.js";

export interface SpectatorTargetFrame {
  readonly render: RenderPose;
  readonly teleported: boolean;
  readonly interpolationNowMs: number;
  readonly interpolationDelayMs: number;
}

export function spectatorTargetFrame(input: {
  readonly connection: Connection;
  readonly interpolation: SpectatorTargetInterpolation;
  readonly state: DungeonSceneState;
  readonly vfx: VfxSystem;
  readonly nowMs: number;
}): SpectatorTargetFrame | null {
  const { connection } = input;
  const pose = connection.spectatorTargetPose;
  if (!connection.world || !connection.body || !connection.welcome || !pose) return null;
  const teleported = connection.teleported;
  consumeSpectatorTeleport({
    connection,
    state: input.state,
    vfx: input.vfx,
    nowMs: input.nowMs,
  });
  const interpolationNowMs = performance.now();
  const interpolationDelayMs = spectatorPresentationDelay(
    connection.interpolationDelay.currentMs,
  );
  const render = input.interpolation.update({
    pose,
    tick: connection.serverTick,
    renderAtMs: connection.serverTimeline.now(interpolationNowMs),
    delayMs: interpolationDelayMs,
    targetId: connection.spectatorTargetId,
    world: connection.world,
    reset: teleported,
  });
  return { render, teleported, interpolationNowMs, interpolationDelayMs };
}

export interface SpectatorFrameSyncInput {
  readonly scene: Phaser.Scene;
  readonly connection: Connection;
  readonly terrain: TerrainRendererLike | undefined;
  readonly lighting: LightingSystem | undefined;
  readonly entityRenderer: EntityRenderer;
  readonly vfx: VfxSystem;
  readonly state: DungeonSceneState;
  readonly torchSyncState: TorchSyncState;
  readonly partyIds: ReadonlySet<string>;
  readonly render: RenderPose;
  readonly interpolationNowMs: number;
  readonly interpolationDelayMs: number;
  readonly nowMs: number;
  readonly deltaMs: number;
  readonly hud: SpectatorHud | undefined;
}

export function syncSpectatorFrame(input: SpectatorFrameSyncInput): void {
  input.connection.deathVisualEvents.push(
    ...input.connection.spectatorDeathPresentations.drain(input.connection.serverTick),
  );
  syncSpectatorWorld(input);
  syncFrame({
    scene: input.scene,
    terrain: input.terrain,
    lighting: input.lighting,
    entityRenderer: input.entityRenderer,
    vfx: input.vfx,
    conn: input.connection,
    inputController: READ_ONLY_PRESENTATION_INPUT,
    state: input.state,
    torchSyncState: input.torchSyncState,
    partyIds: input.partyIds,
    nowMs: input.nowMs,
    dtSeconds: input.deltaMs / 1000,
    render: input.render,
    interpolationNowMs: input.interpolationNowMs,
    interpolationDelayMs: input.interpolationDelayMs,
  });
  input.hud?.update(1000 / input.scene.game.loop.delta);
}

function syncSpectatorWorld(input: {
  readonly scene: Phaser.Scene;
  readonly terrain: TerrainRendererLike | undefined;
  readonly lighting: LightingSystem | undefined;
  readonly render: RenderPose;
  readonly nowMs: number;
}): void {
  syncDungeonWorldPresentation({
    scene: input.scene,
    terrain: input.terrain,
    lighting: input.lighting,
    personal: input.render,
    nowMs: input.nowMs,
    cameraRotationRad: 0,
  });
}
