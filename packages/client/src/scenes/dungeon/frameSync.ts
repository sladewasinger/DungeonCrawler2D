/**
 * Per-frame entity/lighting/vfx sync — split out of DungeonScene to stay under the
 * file-size cap. Pure orchestration over the same render/vfx/terrain systems
 * DungeonScene already owns; every mutable bit it needs travels in as a param and
 * anything it computes comes back out instead of reaching into `this`.
 */
import type Phaser from "phaser";
import { INTERACT_RANGE } from "@dc2d/engine";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import type { InputController } from "../../input/index.js";
import type { Connection } from "../../net/connection.js";
import type { EntityRenderer, PlayerEntityView } from "../../render/entities/index.js";
import type { LightSource } from "../../render/lighting/lightSource.js";
import type { LightingSystem } from "../../render/lighting/index.js";
import type { TerrainRenderer } from "../../render/terrain/index.js";
import { worldToScreen } from "../../render/entities/worldToScreen.js";
import type { VfxSystem } from "../../vfx/index.js";
import { collectExpiredSwings, registerPendingSwing } from "../../vfx/meleeConnect.js";
import { buildAreaTileViews } from "./areaViews.js";
import { nearestDownedPartyMember } from "./contentQueries.js";
import { buildRenderContext, itemView, monsterView, projectileView, remotePlayerView, selfPlayerView } from "./entityViews.js";
import { bucketFrameEntities, type FrameEntityBuckets } from "./frameEntityBuckets.js";
import { resolveInteractionPrompt, type InteractionPrompt } from "./interactionPrompt.js";
import { resolveMeleeSwings } from "./meleeSwingEvents.js";
import { pruneProjectileVelocity } from "./projectileVelocity.js";
import { resolveSelfAimAngle } from "./selfAim.js";
import type { DungeonSceneState, RenderPose } from "./state.js";
import { syncTorches, type TorchSyncState } from "./torchSync.js";
import { applyVisualEvents } from "./visualEvents.js";

export interface EntitySyncResult {
  interactionPrompt: InteractionPrompt | null;
  torchAccentLights: LightSource[];
}

/** Players + monsters + items + the melee-swing wedge telegraph. */
function syncCombatants(
  scene: Phaser.Scene,
  conn: Connection,
  entityRenderer: EntityRenderer,
  vfx: VfxSystem,
  inputController: InputController,
  state: DungeonSceneState,
  nowMs: number,
  render: RenderPose,
  buckets: FrameEntityBuckets,
  context: ReturnType<typeof buildRenderContext>,
): void {
  if (!conn.world || !conn.welcome || !conn.body) return;
  const touchActive = inputController.touchVisual() !== null;
  const aimAngle = resolveSelfAimAngle(touchActive, state.cosmetics.faceX, state.cosmetics.faceY, render, scene.cameras.main, scene.input.activePointer);
  const self = selfPlayerView(
    { id: conn.welcome.playerId, name: conn.name, x: render.x, y: render.y, z: render.z, air: !conn.body.grounded },
    { hp: conn.hp, maxHp: conn.maxHp, fx: conn.fx, downed: conn.downed, blocking: conn.blocking, weaponId: conn.weapon },
    state.cosmetics,
    nowMs,
    aimAngle,
  );
  const players = buckets.players.map(remotePlayerView);
  const allPlayers = [self, ...players];
  entityRenderer.syncPlayers(allPlayers, context);
  entityRenderer.syncMonsters(buckets.enemies.map(monsterView), context);
  entityRenderer.syncItems(buckets.items.map(itemView), nowMs);
  spawnMeleeSwings(vfx, state, allPlayers, nowMs);
}

/** Spawns the wedge telegraph for every swing that just started, and registers each as
 * pending a correlating hit (panel round 3b item 5, WHIFF FEEDBACK) — syncLightingAndVfx
 * later flushes whichever ones time out into the whiff cue (meleeConnect.ts). */
function spawnMeleeSwings(vfx: VfxSystem, state: DungeonSceneState, allPlayers: PlayerEntityView[], nowMs: number): void {
  for (const swing of resolveMeleeSwings(allPlayers, state.attackFlags)) {
    vfx.spawnMeleeSwing(swing.id, swing.worldX, swing.worldY, swing.z, swing.angleRad, swing.depth, SCREEN_TILE_PX, nowMs);
    registerPendingSwing(state.pendingSwings, {
      attackerId: swing.id,
      worldX: swing.worldX,
      worldY: swing.worldY,
      z: swing.z,
      angleRad: swing.angleRad,
      depth: swing.depth,
      startedAtMs: nowMs,
    });
  }
}

/** Rebuilds every rendered entity (players/monsters/items/projectiles/torches) for this frame. */
export function syncEntities(
  scene: Phaser.Scene,
  conn: Connection,
  entityRenderer: EntityRenderer,
  vfx: VfxSystem,
  terrain: TerrainRenderer | undefined,
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
  const context = buildRenderContext(conn.world, nowMs, dtSeconds, render.x, render.y, partyIds);
  syncCombatants(scene, conn, entityRenderer, vfx, inputController, state, nowMs, render, buckets, context);

  entityRenderer.syncProjectiles(buckets.projectiles.map((e) => projectileView(e, state.projectileVelocity, nowMs)));
  pruneProjectileVelocity(state.projectileVelocity, buckets.projectileIds);

  let torchAccentLights: LightSource[] = [];
  if (terrain) {
    const torchSync = syncTorches(torchSyncState, buckets.torches, terrain, conn.serverTick);
    entityRenderer.syncTorches(torchSync.views, context);
    torchAccentLights = torchSync.accentLights;
  }

  const body = conn.body;
  const reviveTarget = conn.party
    ? nearestDownedPartyMember(conn.party.members, body.x, body.y, INTERACT_RANGE)
    : undefined;
  return {
    interactionPrompt: resolveInteractionPrompt(conn.world, body.x, body.y, buckets.pickupTargets, reviveTarget),
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
  terrain: TerrainRenderer | undefined,
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
    buildAreaTileViews(conn.areaTiles, camera.worldView, 2 * SCREEN_TILE_PX),
  );
  lighting.setAccentLights([...areaLights, ...torchAccentLights]);
  lighting.update(camera.worldView, render.x, render.y, nowMs);
  // Flame emitters only for torches near the camera view: uncapped, every
  // resident torch (~140) ran a continuous ParticleEmitter — a large slice of
  // baseline frame cost on weak hardware (leak-hunt probe, 2026-07-20).
  const view = camera.worldView;
  const marginPx = 2 * SCREEN_TILE_PX;
  vfx.syncTorchFlames(
    lighting.activeTorches().filter((t) => {
      // t.x/t.y are real world tile units (LightSource's own contract) — route through
      // the seam so this margin-cull compares like-with-like against camera.worldView,
      // which is itself in view-pixel space once worldToScreen (below) is oriented.
      const { x: sx, y: sy } = worldToScreen(t.x, t.y);
      return (
        sx >= view.x - marginPx && sx <= view.right + marginPx &&
        sy >= view.y - marginPx && sy <= view.bottom + marginPx
      );
    }),
  );
  vfx.trackPlayerMotion({ x: render.x, y: render.y, air: !conn.body.grounded, faceX: state.cosmetics.faceX }, nowMs);
  // Panel round 3b item 5 (WHIFF FEEDBACK): swings nobody correlated a hit against in
  // time (visualEvents.ts's applyHit resolves the ones that DID connect) — flush
  // whatever's left over into the whiff cue before this frame's vfx.update fades it.
  for (const swing of collectExpiredSwings(state.pendingSwings, nowMs)) {
    vfx.spawnMeleeWhiff(swing.attackerId, swing.worldX, swing.worldY, swing.z, swing.angleRad, swing.depth, SCREEN_TILE_PX, nowMs);
  }
  applyVisualEvents(conn, vfx, render, state.pendingSwings, nowMs);
  // Panel round 4 (LANE B): shield ring, self-only — countdown itself is driven by
  // selfCosmetics.ts's consumeRespawnGrace/endSelfGrace.
  vfx.graceRing.sync(render.x, render.y, state.cosmetics.graceUntilMs, nowMs);
  vfx.update(nowMs);
}
