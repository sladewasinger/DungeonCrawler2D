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
import type { TerrainRenderer } from "../../render/terrain/index.js";
import { worldToScreen } from "../../render/entities/worldToScreen.js";
import type { VfxSystem } from "../../vfx/index.js";
import { buildAreaTileViews } from "./areaViews.js";
import { buildRenderContext, itemView, monsterView, projectileView, remotePlayerView, selfPlayerView } from "./entityViews.js";
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

/** Remote entities render this far in the past, lerped between snapshot samples. */
const INTERP_DELAY_MS = 100;

/** Players + monsters + items + the melee-swing wedge telegraph. */
function syncCombatants(
  scene: Phaser.Scene,
  conn: Connection,
  entityRenderer: EntityRenderer,
  vfx: VfxSystem,
  inputController: InputController,
  state: DungeonSceneState,
  partyIds: ReadonlySet<string>,
  nowMs: number,
  dtSeconds: number,
  render: RenderPose,
  interpolated: ReturnType<Connection["interpolated"]>,
): void {
  if (!conn.world || !conn.welcome || !conn.body) return;
  const items = interpolated.filter((e) => e.snap.kind === "item");
  const context = buildRenderContext(conn.world, nowMs, dtSeconds, render.x, render.y, partyIds);
  const touchActive = inputController.touchVisual() !== null;
  const aimAngle = resolveSelfAimAngle(touchActive, state.cosmetics.faceX, state.cosmetics.faceY, render, scene.cameras.main, scene.input.activePointer);
  const self = selfPlayerView(
    { id: conn.welcome.playerId, name: conn.name, x: render.x, y: render.y, z: render.z, air: !conn.body.grounded },
    { hp: conn.hp, maxHp: conn.maxHp, fx: conn.fx, downed: conn.downed, weaponId: conn.weapon },
    state.cosmetics,
    nowMs,
    aimAngle,
  );
  const players = interpolated.filter((e) => e.snap.kind === "player").map(remotePlayerView);
  const allPlayers = [self, ...players];
  entityRenderer.syncPlayers(allPlayers, context);
  entityRenderer.syncMonsters(interpolated.filter((e) => e.snap.kind === "enemy").map(monsterView), context);
  entityRenderer.syncItems(items.map(itemView), nowMs);
  for (const swing of resolveMeleeSwings(allPlayers, state.attackFlags)) {
    vfx.spawnMeleeSwing(swing.id, swing.worldX, swing.worldY, swing.z, swing.angleRad, swing.depth, SCREEN_TILE_PX, nowMs);
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
  const interpolated = conn.interpolated(INTERP_DELAY_MS);
  syncCombatants(scene, conn, entityRenderer, vfx, inputController, state, partyIds, nowMs, dtSeconds, render, interpolated);

  const projectiles = interpolated.filter((e) => e.snap.kind === "projectile");
  entityRenderer.syncProjectiles(projectiles.map((e) => projectileView(e, state.projectileVelocity, nowMs)));
  pruneProjectileVelocity(state.projectileVelocity, new Set(projectiles.map((e) => e.id)));

  let torchAccentLights: LightSource[] = [];
  if (terrain) {
    const torches = interpolated.filter((e) => e.snap.kind === "torch");
    const torchSync = syncTorches(torchSyncState, torches, terrain, conn.serverTick);
    const context = buildRenderContext(conn.world, nowMs, dtSeconds, render.x, render.y, partyIds);
    entityRenderer.syncTorches(torchSync.views, context);
    torchAccentLights = torchSync.accentLights;
  }

  const items = interpolated.filter((e) => e.snap.kind === "item");
  return { interactionPrompt: resolveInteractionPrompt(conn.world, render.x, render.y, items), torchAccentLights };
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
  const areaLights = vfx.syncAreas(buildAreaTileViews(conn.areaTiles));
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
  applyVisualEvents(conn, vfx, render, nowMs);
  vfx.update(nowMs);
}
