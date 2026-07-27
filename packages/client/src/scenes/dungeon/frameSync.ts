/**
 * Per-frame entity/lighting/vfx sync — split out of DungeonScene to stay under the
 * file-size cap. Pure orchestration over the same render/vfx/terrain systems
 * DungeonScene already owns; every mutable bit it needs travels in as a param and
 * anything it computes comes back out instead of reaching into `this`.
 */
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import type { InputController } from "../../input/index.js";
import type { Connection } from "../../net/connection.js";
import type { EntityRenderer } from "../../render/entities/index.js";
import type { LightSource } from "../../render/lighting/lightSource.js";
import type { LightingSystem } from "../../render/lighting/index.js";
import type { TerrainRendererLike } from "../../render/terrain4/index.js";
import { worldToScreen } from "../../render/entities/worldToScreen.js";
import type { VfxSystem } from "../../vfx/index.js";
import { collectExpiredSwingsInto } from "../../vfx/meleeConnect.js";
import { buildAreaTileViewsInto } from "./areaViews.js";
import { syncCombatants } from "./combatantSync.js";
import { buildRenderContext, projectileView } from "./entityViews.js";
import { bucketFrameEntities } from "./frameEntityBuckets.js";
import { mapFrameInto } from "./frameEntityViews.js";
import type { InteractionPrompt } from "./interactionPrompt.js";
import { resolveFrameInteractionPrompt } from "./frameInteractionPrompt.js";
import { pruneProjectileVelocity } from "./projectileVelocity.js";
import type { DungeonSceneState, RenderPose } from "./state.js";
import { syncTorches, type TorchSyncState } from "./torchSync.js";
import { applyVisualEvents } from "./visualEvents.js";

export interface EntitySyncResult {
  interactionPrompt: InteractionPrompt | null;
  torchAccentLights: LightSource[];
}

/** Players + monsters + items + the melee-swing wedge telegraph. */
/** Spawns the wedge telegraph for every swing that just started, and registers each as
 * pending a correlating hit (panel round 3b item 5, WHIFF FEEDBACK) — syncLightingAndVfx
 * later flushes whichever ones time out into the whiff cue (meleeConnect.ts). */
/** Rebuilds every rendered entity (players/monsters/items/projectiles/torches) for this frame. */
export function syncEntities(
  scene: Phaser.Scene,
  conn: Connection,
  entityRenderer: EntityRenderer,
  vfx: VfxSystem,
  terrain: TerrainRendererLike | undefined,
  inputController: InputController,
  state: DungeonSceneState,
  torchSyncState: TorchSyncState,
  partyIds: ReadonlySet<string>,
  nowMs: number,
  dtSeconds: number,
  render: RenderPose,
): EntitySyncResult {
  if (!conn.world || !conn.welcome || !conn.body) return { interactionPrompt: null, torchAccentLights: [] };
  const interpolated = conn.interpolated();
  const buckets = bucketFrameEntities(interpolated, state.entityBuckets);
  const context = buildRenderContext(conn.world, nowMs, dtSeconds, render.x, render.y, partyIds, state.renderContext ?? undefined);
  state.renderContext = context; entityRenderer.syncRoom(conn, nowMs);
  syncCombatants(scene, conn, entityRenderer, vfx, inputController, state, nowMs, render, buckets, context);

  entityRenderer.syncProjectiles(mapFrameInto(
    buckets.projectiles, state.entityViews.projectiles, state.entityViews.projectileRecords,
    (entity, target) => projectileView(entity, state.projectileVelocity, nowMs, target),
  ));
  pruneProjectileVelocity(state.projectileVelocity, buckets.projectileIds);

  let torchAccentLights: LightSource[] = [];
  if (terrain) {
    const torchSync = syncTorches(torchSyncState, buckets.torches, terrain, conn.serverTick);
    entityRenderer.syncTorches(torchSync.views, context);
    torchAccentLights = torchSync.accentLights;
  }

  return {
    interactionPrompt: resolveFrameInteractionPrompt(conn, buckets),
    torchAccentLights,
  };
}

/**
 * The full per-frame entity + lighting/vfx sync, composed — DungeonScene.update()'s own
 * length-cap split: it just calls this and assigns the two returned fields, rather than
 * inlining both syncEntities and syncLightingAndVfx calls itself.
 */
export function syncFrame(
  scene: Phaser.Scene,
  conn: Connection,
  entityRenderer: EntityRenderer,
  vfx: VfxSystem,
  terrain: TerrainRendererLike | undefined,
  lighting: LightingSystem | undefined,
  inputController: InputController,
  state: DungeonSceneState,
  torchSyncState: TorchSyncState,
  partyIds: ReadonlySet<string>,
  nowMs: number,
  dtSeconds: number,
  render: RenderPose,
): EntitySyncResult {
  const synced = syncEntities(scene, conn, entityRenderer, vfx, terrain, inputController, state, torchSyncState, partyIds, nowMs, dtSeconds, render);
  syncLightingAndVfx(conn, lighting, vfx, scene.cameras.main, synced.torchAccentLights, state, nowMs, render);
  return synced;
}

/** Feeds this frame's lighting/vfx systems from the connection + accumulated accent lights. */
export function syncLightingAndVfx(
  conn: Connection,
  lighting: LightingSystem | undefined,
  vfx: VfxSystem,
  camera: Phaser.Cameras.Scene2D.Camera,
  torchAccentLights: LightSource[],
  state: DungeonSceneState,
  nowMs: number,
  render: RenderPose,
): void {
  if (!lighting || !conn.body) return;
  const areaLights = vfx.syncAreas(
    buildAreaTileViewsInto(conn.areaTiles, camera.worldView, 2 * SCREEN_TILE_PX, state.areaViews, state.areaViewRecords),
  );
  const accentLights = state.accentLights;
  accentLights.length = 0;
  accentLights.push(...areaLights, ...torchAccentLights);
  lighting.setAccentLights(accentLights);
  lighting.update(camera.worldView, render.x, render.y, nowMs);
  // Flame emitters only for torches near the camera view: uncapped, every
  // resident torch (~140) ran a continuous ParticleEmitter — a large slice of
  // baseline frame cost on weak hardware (leak-hunt probe, 2026-07-20).
  const view = camera.worldView;
  const marginPx = 2 * SCREEN_TILE_PX;
  const visibleTorchLights = state.visibleTorchLights;
  visibleTorchLights.length = 0;
  for (const torch of lighting.activeTorches()) {
      // t.x/t.y are real world tile units (LightSource's own contract) — route through
      // the seam so this margin-cull compares like-with-like against camera.worldView,
      // which is itself in view-pixel space once worldToScreen (below) is oriented.
      const { x: sx, y: sy } = worldToScreen(torch.x, torch.y);
      if (
        sx >= view.x - marginPx && sx <= view.right + marginPx &&
        sy >= view.y - marginPx && sy <= view.bottom + marginPx
      ) visibleTorchLights.push(torch);
  }
  vfx.syncTorchFlames(visibleTorchLights);
  // Panel round 3b item 5 (WHIFF FEEDBACK): swings nobody correlated a hit against in
  // time (visualEvents.ts's applyHit resolves the ones that DID connect) — flush
  // whatever's left over into the whiff cue before this frame's vfx.update fades it.
  for (const swing of collectExpiredSwingsInto(state.pendingSwings, nowMs, state.expiredSwings)) {
    vfx.spawnMeleeWhiff(swing.attackerId, swing.worldX, swing.worldY, swing.z, swing.angleRad, swing.depth, SCREEN_TILE_PX, nowMs);
  }
  applyVisualEvents(conn, vfx, render, state.pendingSwings, nowMs);
  // Panel round 4 (LANE B): shield ring, self-only — countdown itself is driven by
  // selfCosmetics.ts's consumeRespawnGrace/endSelfGrace.
  syncSelfVfx(conn, vfx, state, render, nowMs);
}

function syncSelfVfx(
  conn: Connection,
  vfx: VfxSystem,
  state: DungeonSceneState,
  render: RenderPose,
  nowMs: number,
): void {
  if (!conn.body) return;
  vfx.trackPlayerMotion(render.x, render.y, !conn.body.grounded, state.cosmetics.faceX, nowMs);
  vfx.graceRing.sync(render.x, render.y, state.cosmetics.graceUntilMs, nowMs);
  vfx.syncOutOfBreath(
    render.x, render.y, render.z,
    state.cosmetics.spriteFaceX, conn.staminaExhausted, nowMs,
  );
  vfx.update(nowMs);
}
