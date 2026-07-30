import type Phaser from "phaser";
import type { InputController } from "../../../input/index.js";
import type { Connection } from "../../../net/connection/connection.js";
import type { EntityRenderer } from "../../../render/entities/geometry/index.js";
import type { LightSource } from "../../../render/lighting/core/lightSource.js";
import type { LightingSystem } from "../../../render/lighting/index.js";
import type { TerrainRendererLike } from "../../../render/terrain/index.js";
import type { VfxSystem } from "../../../vfx/system/index.js";
import { syncCombatants } from "../entities/combatantSync.js";
import { buildRenderContext, projectileView } from "../entities/entityViews.js";
import { bucketFrameEntities } from "./frameEntityBuckets.js";
import { mapFrameInto } from "../entities/frameEntityViews.js";
import type { InteractionPrompt } from "../world/interactionPrompt.js";
import { resolveFrameInteractionPrompt } from "./frameInteractionPrompt.js";
import { pruneProjectileVelocity } from "../player/projectileVelocity.js";
import type { DungeonSceneState, RenderPose } from "../orchestration/state.js";
import { syncTorches, type TorchSyncState } from "../entities/torches/sync.js";
import { presentationEntityFilter } from "./entityPresentationFilter.js";
import { syncLightingAndVfx } from "./frameLightingSync.js";

export interface EntitySyncResult {
  interactionPrompt: InteractionPrompt | null;
  torchAccentLights: LightSource[];
}

export interface FrameSyncContext {
  readonly scene: Phaser.Scene;
  readonly conn: Connection;
  readonly entityRenderer: EntityRenderer;
  readonly vfx: VfxSystem;
  readonly terrain: TerrainRendererLike | undefined;
  readonly lighting: LightingSystem | undefined;
  readonly inputController: InputController;
  readonly state: DungeonSceneState;
  readonly torchSyncState: TorchSyncState;
  readonly partyIds: ReadonlySet<string>;
  readonly nowMs: number;
  readonly dtSeconds: number;
  readonly render: RenderPose;
}

export function syncEntities(context: FrameSyncContext): EntitySyncResult {
  const {
    scene,
    conn,
    entityRenderer,
    vfx,
    terrain,
    inputController,
    state,
    torchSyncState,
    partyIds,
    nowMs,
    dtSeconds,
    render,
  } = context;
  if (!conn.world || !conn.welcome || !conn.body) return { interactionPrompt: null, torchAccentLights: [] };
  const interpolated = conn.interpolated(performance.now(),
    framePresentationFilter(context));
  const buckets = bucketFrameEntities(interpolated, state.entityBuckets, {
    viewerX: render.x,
    viewerY: render.y,
  });
  const renderContext = buildRenderContext({
    world: conn.world, nowMs, dtSeconds, selfX: render.x, selfY: render.y,
    partyIds, target: state.renderContext ?? undefined,
  });
  state.renderContext = renderContext; entityRenderer.syncRoom(conn, nowMs);
  syncCombatants({ scene, conn, entityRenderer, vfx, inputController, state, nowMs, render, buckets, context: renderContext });
  syncProjectiles(context, buckets);
  const torchAccentLights = syncFrameTorches({ terrain, torchSyncState, torches: buckets.torches, serverTick: conn.serverTick, entityRenderer, renderContext });
  return {
    interactionPrompt: resolveFrameInteractionPrompt(conn, buckets),
    torchAccentLights,
  };
}

function framePresentationFilter(
  context: FrameSyncContext,
) {
  const { scene, conn, inputController, nowMs, render, lighting, terrain } = context;
  const toonActive = lighting?.prepareToonVisibility({
    view: scene.cameras.main.worldView,
    personal: render,
    nowMs,
  });
  return presentationEntityFilter({
    inputController,
    localPlayerId: conn.welcome!.playerId,
    viewerX: render.x,
    viewerY: render.y,
    viewport: scene.cameras.main.worldView,
    constrainedPresentation: terrain?.constrainedPresentation === true,
    terrainVisibility: toonActive ? lighting : undefined,
  });
}

function syncProjectiles(context: FrameSyncContext, buckets: ReturnType<typeof bucketFrameEntities>): void {
  const { entityRenderer, state, nowMs } = context;
  entityRenderer.syncProjectiles(mapFrameInto({
    source: buckets.projectiles, out: state.entityViews.projectiles, records: state.entityViews.projectileRecords,
    map: (entity, target) => projectileView({ e: entity, velocity: state.projectileVelocity, nowMs, target }),
  }));
  pruneProjectileVelocity(state.projectileVelocity, buckets.projectileIds);
}

interface TorchFrameSyncRequest {
  readonly terrain: TerrainRendererLike | undefined;
  readonly torchSyncState: TorchSyncState;
  readonly torches: ReturnType<typeof bucketFrameEntities>["torches"];
  readonly serverTick: number;
  readonly entityRenderer: EntityRenderer;
  readonly renderContext: ReturnType<typeof buildRenderContext>;
}

function syncFrameTorches(request: TorchFrameSyncRequest): LightSource[] {
  const { terrain, torchSyncState, torches, serverTick, entityRenderer, renderContext } = request;
  if (!terrain) return [];
  const torchSync = syncTorches({ state: torchSyncState, torches, terrain, serverTick });
  entityRenderer.syncTorches(torchSync.views, renderContext);
  return torchSync.accentLights;
}

export function syncFrame(context: FrameSyncContext): EntitySyncResult {
  const synced = syncEntities(context);
  syncLightingAndVfx(context, synced.torchAccentLights);
  return synced;
}
