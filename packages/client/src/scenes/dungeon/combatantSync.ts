import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import type { InputController } from "../../input/index.js";
import type { Connection } from "../../net/connection.js";
import type {
  EntityRenderer,
  PlayerEntityView,
  RenderContext,
} from "../../render/entities/index.js";
import { combatOverlayPosition, depthForEntityNow } from "../../render/entities/worldToScreen.js";
import { depthForAdjacentTerrainOverlay } from "../../render/entities/depthSort.js";
import type { VfxSystem } from "../../vfx/index.js";
import { registerPendingSwing } from "../../vfx/meleeConnect.js";
import {
  itemView,
  monsterView,
  petView,
  remotePlayerView,
  selfPlayerView,
} from "./entityViews.js";
import { syncDamageVfx } from "./damageVfxTracking.js";
import type { FrameEntityBuckets } from "./frameEntityBuckets.js";
import { mapFrameInto } from "./frameEntityViews.js";
import { resolveMeleeSwingsInto } from "./meleeSwingEvents.js";
import { resolveSelfAimAngle } from "./selfAim.js";
import type { DungeonSceneState, RenderPose } from "./state.js";

export function syncCombatants(
  scene: Phaser.Scene,
  conn: Connection,
  entityRenderer: EntityRenderer,
  vfx: VfxSystem,
  inputController: InputController,
  state: DungeonSceneState,
  nowMs: number,
  render: RenderPose,
  buckets: FrameEntityBuckets,
  context: RenderContext,
): void {
  if (!conn.world || !conn.welcome || !conn.body) return;
  const touchActive = inputController.touchVisual() !== null;
  const aimAngle = resolveSelfAimAngle(touchActive, state.cosmetics.faceX, state.cosmetics.faceY, render, scene.cameras.main, scene.input.activePointer);
  const players = syncPlayerViews(conn, state, buckets, render, nowMs, aimAngle);
  const monsters = mapFrameInto(
    buckets.enemies, state.entityViews.enemies, state.entityViews.enemyRecords, monsterView,
  );
  const pets = mapFrameInto(buckets.pets, state.entityViews.pets, state.entityViews.petRecords, petView);
  syncDamageVfx(
    state.combatHealth,
    state.combatHealthSeen,
    conn.world,
    vfx,
    players,
    monsters,
    state.pendingSwings,
    conn.welcome.playerId,
    { x: conn.body.kx, y: conn.body.ky },
    nowMs,
    conn.drainDeathVisualEvents(),
  );
  entityRenderer.syncPlayers(players, context);
  entityRenderer.syncMonsters(monsters, context);
  entityRenderer.syncPets(pets, context);
  syncItemViews(conn, entityRenderer, state, buckets, render, nowMs);
  spawnMeleeSwings(vfx, state, players, nowMs, context);
}

function syncItemViews(
  conn: Connection,
  renderer: EntityRenderer,
  state: DungeonSceneState,
  buckets: FrameEntityBuckets,
  render: RenderPose,
  nowMs: number,
): void {
  const context = { serverTick: conn.serverTick, selfX: render.x, selfY: render.y };
  renderer.syncItems(mapFrameInto(
    buckets.items,
    state.entityViews.items,
    state.entityViews.itemRecords,
    (entity, target) => itemView(entity, target, context),
  ), nowMs);
}

function syncPlayerViews(
  conn: Connection,
  state: DungeonSceneState,
  buckets: FrameEntityBuckets,
  render: RenderPose,
  nowMs: number,
  aimAngle: number,
): PlayerEntityView[] {
  if (!conn.welcome || !conn.body) return state.entityViews.players;
  const players = state.entityViews.players;
  const records = state.entityViews.playerRecords;
  players.length = buckets.players.length + 1;
  updateSelfSource(conn, state, render);
  const self = selfPlayerView(
    state.selfPose,
    state.selfVitals,
    state.cosmetics,
    nowMs,
    aimAngle,
    records[0],
  );
  records[0] = self;
  players[0] = self;
  for (let index = 0; index < buckets.players.length; index++) {
    const remote = buckets.players[index];
    if (!remote) continue;
    const recordIndex = index + 1;
    const view = remotePlayerView(remote, records[recordIndex]);
    records[recordIndex] = view;
    players[recordIndex] = view;
  }
  return players;
}

function updateSelfSource(
  conn: Connection,
  state: DungeonSceneState,
  render: RenderPose,
): void {
  if (!conn.welcome || !conn.body) return;
  const pose = state.selfPose;
  pose.id = conn.welcome.playerId;
  pose.skin = conn.skin;
  pose.name = conn.name;
  pose.x = render.x;
  pose.y = render.y;
  pose.z = render.z;
  pose.air = !conn.body.grounded;
  const vitals = state.selfVitals;
  vitals.hp = conn.hp;
  vitals.maxHp = conn.maxHp;
  vitals.fx = conn.fx;
  vitals.downed = conn.downed;
  vitals.reviveProgress = conn.reviveProgress;
  vitals.blocking = conn.blocking;
  vitals.weaponId = conn.weapon;
}

function spawnMeleeSwings(
  vfx: VfxSystem,
  state: DungeonSceneState,
  players: PlayerEntityView[],
  nowMs: number,
  context: RenderContext,
): void {
  const swings = resolveMeleeSwingsInto(
    players,
    state.attackFlags,
    state.swingSpawns,
    state.swingSpawnRecords,
    state.swingSeen,
  );
  for (const swing of swings) {
    const overlay = combatOverlayPosition(swing.worldX, swing.worldY, swing.z, context.world);
    swing.depth = depthForAdjacentTerrainOverlay(
      overlay.wielderViewY,
      depthForEntityNow(swing.worldX, swing.worldY),
      overlay.screenSouthFloorHigher,
    );
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
