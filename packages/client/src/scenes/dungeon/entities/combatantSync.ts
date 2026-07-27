import type Phaser from "phaser";
import type { InputController } from "../../../input/index.js";
import type { Connection } from "../../../net/connection/connection.js";
import type {
  EntityRenderer,
  PlayerEntityView,
  RenderContext,
} from "../../../render/entities/geometry/index.js";
import type { VfxSystem } from "../../../vfx/system/index.js";
import {
  itemView,
  monsterView,
  petView,
  remotePlayerView,
  selfPlayerView,
} from "./entityViews.js";
import { syncDamageVfx } from "../visuals/damageVfxTracking.js";
import type { FrameEntityBuckets } from "../frame/frameEntityBuckets.js";
import { mapFrameInto } from "./frameEntityViews.js";
import { resolveSelfAimAngle } from "../player/selfAim.js";
import type { DungeonSceneState, RenderPose } from "../orchestration/state.js";
import { syncMeleeSwings } from "../combat/meleeSwingSync.js";

export interface CombatantSyncFrame {
  readonly scene: Phaser.Scene;
  readonly conn: Connection;
  readonly entityRenderer: EntityRenderer;
  readonly vfx: VfxSystem;
  readonly inputController: InputController;
  readonly state: DungeonSceneState;
  readonly nowMs: number;
  readonly render: RenderPose;
  readonly buckets: FrameEntityBuckets;
  readonly context: RenderContext;
}

export function syncCombatants(frame: CombatantSyncFrame): void {
  const { scene, conn, entityRenderer, vfx, inputController, state, nowMs, render, buckets, context } = frame;
  if (!conn.world || !conn.welcome || !conn.body) return;
  const touchActive = inputController.touchVisual() !== null;
  const aimAngle = resolveSelfAimAngle({ touchActive, faceX: state.cosmetics.faceX, faceY: state.cosmetics.faceY, render, camera: scene.cameras.main, pointer: scene.input.activePointer });
  const players = syncPlayerViews({ conn, state, buckets, render, nowMs, aimAngle });
  const monsters = mapFrameInto({ source: buckets.enemies, out: state.entityViews.enemies, records: state.entityViews.enemyRecords, map: monsterView });
  const pets = mapFrameInto({ source: buckets.pets, out: state.entityViews.pets, records: state.entityViews.petRecords, map: petView });
  syncDamageVfx({
    tracked: state.combatHealth,
    seen: state.combatHealthSeen,
    world: conn.world,
    vfx,
    players,
    monsters,
    pendingSwings: state.pendingSwings,
    selfId: conn.welcome.playerId,
    nowMs,
    deaths: conn.drainDeathVisualEvents(),
  });
  syncRenderedCombatants({ entityRenderer, players, monsters, pets, context });
  syncItemViews({ conn, renderer: entityRenderer, state, buckets, render, nowMs });
  syncMeleeSwings({ vfx, state, players, nowMs, context });
}

function syncRenderedCombatants(input: {
  readonly entityRenderer: EntityRenderer; readonly players: PlayerEntityView[];
  readonly monsters: ReturnType<typeof monsterView>[]; readonly pets: ReturnType<typeof petView>[];
  readonly context: RenderContext;
}): void {
  const { entityRenderer, players, monsters, pets, context } = input;
  entityRenderer.syncPlayers(players, context); entityRenderer.syncMonsters(monsters, context);
  entityRenderer.syncPets(pets, context);
}

interface ItemViewSyncInput {
  readonly conn: Connection; readonly renderer: EntityRenderer; readonly state: DungeonSceneState;
  readonly buckets: FrameEntityBuckets; readonly render: RenderPose; readonly nowMs: number;
}

function syncItemViews(input: ItemViewSyncInput): void {
  const { conn, renderer, state, buckets, render, nowMs } = input;
  const context = { serverTick: conn.serverTick, selfX: render.x, selfY: render.y };
  renderer.syncItems(mapFrameInto({
    source: buckets.items, out: state.entityViews.items, records: state.entityViews.itemRecords,
    map: (entity, target) => itemView({ e: entity, target, context }),
  }), nowMs);
}

interface PlayerViewSyncInput {
  readonly conn: Connection; readonly state: DungeonSceneState; readonly buckets: FrameEntityBuckets;
  readonly render: RenderPose; readonly nowMs: number; readonly aimAngle: number;
}

function syncPlayerViews(input: PlayerViewSyncInput): PlayerEntityView[] {
  const { conn, state, buckets, render, nowMs, aimAngle } = input;
  if (!conn.welcome || !conn.body) return state.entityViews.players;
  const players = state.entityViews.players;
  const records = state.entityViews.playerRecords;
  players.length = buckets.players.length + 1;
  updateSelfSource(conn, state, render);
  const self = selfPlayerView({
    pose: state.selfPose, vitals: state.selfVitals, cosmetics: state.cosmetics,
    nowMs, weaponAimAngle: aimAngle, target: records[0],
  });
  records[0] = self;
  players[0] = self;
  syncRemotePlayers(buckets, players, records);
  return players;
}

function syncRemotePlayers(
  buckets: FrameEntityBuckets,
  players: PlayerEntityView[],
  records: PlayerEntityView[],
): void {
  for (let index = 0; index < buckets.players.length; index++) {
    const remote = buckets.players[index];
    if (!remote) continue;
    const recordIndex = index + 1;
    const view = remotePlayerView(remote, records[recordIndex]);
    records[recordIndex] = view;
    players[recordIndex] = view;
  }
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
