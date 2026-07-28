import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import type { InputController } from "../../../input/index.js";
import type { Connection } from "../../../net/connection/connection.js";
import type { EntityRenderer } from "../../../render/entities/geometry/index.js";
import type { LightSource } from "../../../render/lighting/core/lightSource.js";
import type { LightingSystem } from "../../../render/lighting/index.js";
import type { TerrainRendererLike } from "../../../render/terrain4/index.js";
import { worldToScreen } from "../../../render/entities/geometry/worldToScreen.js";
import type { VfxSystem } from "../../../vfx/system/index.js";
import { collectExpiredSwingsInto } from "../../../vfx/combat/meleeConnect.js";
import { buildAreaTileViewsInto } from "../world/areaViews.js";
import { syncCombatants } from "../entities/combatantSync.js";
import { buildRenderContext, projectileView } from "../entities/entityViews.js";
import { bucketFrameEntities } from "./frameEntityBuckets.js";
import { mapFrameInto } from "../entities/frameEntityViews.js";
import type { InteractionPrompt } from "../world/interactionPrompt.js";
import { resolveFrameInteractionPrompt } from "./frameInteractionPrompt.js";
import { pruneProjectileVelocity } from "../player/projectileVelocity.js";
import type { DungeonSceneState, RenderPose } from "../orchestration/state.js";
import { syncTorches, type TorchSyncState } from "../entities/torchSync.js";
import { applyVisualEvents } from "../visuals/visualEvents.js";

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
  const { scene, conn, entityRenderer, vfx, terrain, inputController, state, torchSyncState, partyIds, nowMs, dtSeconds, render } = context;
  if (!conn.world || !conn.welcome || !conn.body) return { interactionPrompt: null, torchAccentLights: [] };
  const interpolated = conn.interpolated();
  const buckets = bucketFrameEntities(interpolated, state.entityBuckets);
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

export function syncLightingAndVfx(context: FrameSyncContext, torchAccentLights: LightSource[]): void {
  applyVisualEvents({ ...context, pendingSwings: context.state.pendingSwings });
  if (!context.lighting || !context.conn.body) return;
  updateLighting(context, torchAccentLights);
  syncVisibleTorchFlames(context);
  syncExpiredWhiffs(context);
  syncSelfVfx(context);
}

function updateLighting(context: FrameSyncContext, torchAccentLights: LightSource[]): void {
  const { conn, lighting, vfx, scene, state, nowMs, render } = context;
  if (!lighting) return;
  const areaLights = vfx.syncAreas(buildAreaTileViewsInto({ areaTiles: conn.areaTiles, bounds: scene.cameras.main.worldView, marginPx: 2 * SCREEN_TILE_PX, views: state.areaViews, records: state.areaViewRecords }));
  state.accentLights.length = 0;
  state.accentLights.push(...areaLights, ...torchAccentLights);
  lighting.setAccentLights(state.accentLights);
  lighting.update({ view: scene.cameras.main.worldView, personal: render, nowMs });
}

function syncVisibleTorchFlames(context: FrameSyncContext): void {
  const { lighting, scene, state, vfx } = context;
  if (!lighting) return;
  const view = scene.cameras.main.worldView;
  const marginPx = 2 * SCREEN_TILE_PX;
  const visibleTorchLights = state.visibleTorchLights;
  visibleTorchLights.length = 0;
  for (const torch of lighting.activeTorches()) {
      const { x: sx, y: sy } = worldToScreen(torch.x, torch.y);
      if (sx >= view.x - marginPx && sx <= view.right + marginPx && sy >= view.y - marginPx && sy <= view.bottom + marginPx) visibleTorchLights.push(torch);
  }
  vfx.syncTorchFlames(visibleTorchLights);
}

function syncExpiredWhiffs({ state, nowMs, vfx }: FrameSyncContext): void {
  // Panel round 3b item 5 (WHIFF FEEDBACK): swings nobody correlated a hit against in
  // time (visualEvents.ts's applyHit resolves the ones that DID connect) — flush
  // whatever's left over into the whiff cue before this frame's vfx.update fades it.
  for (const swing of collectExpiredSwingsInto(state.pendingSwings, nowMs, state.expiredSwings)) {
    vfx.spawnMeleeWhiff({
      id: swing.attackerId,
      x: swing.worldX,
      y: swing.worldY,
      z: swing.z,
      angleRad: swing.angleRad,
      depth: swing.depth,
      tilePx: SCREEN_TILE_PX,
      nowMs,
    });
  }
}

function syncSelfVfx({ conn, vfx, state, render, nowMs }: FrameSyncContext): void {
  if (!conn.body) return;
  const groundHeight = conn.world?.groundAt(render.x, render.y) ?? 0;
  vfx.trackPlayerMotion({ x: render.x, y: render.y, groundHeight, air: !conn.body.grounded, faceX: state.cosmetics.faceX, nowMs });
  vfx.graceRing.sync({ x: render.x, y: render.y, graceUntilMs: state.cosmetics.graceUntilMs, nowMs });
  vfx.syncOutOfBreath({ x: render.x, y: render.y, z: render.z, faceX: state.cosmetics.spriteFaceX, exhausted: conn.staminaExhausted, nowMs });
  vfx.update(nowMs);
}
