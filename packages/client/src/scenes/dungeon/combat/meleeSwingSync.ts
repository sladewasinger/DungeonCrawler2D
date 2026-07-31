import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import type { PlayerEntityView, RenderContext } from "../../../render/entities/geometry/index.js";
import { combatOverlayPosition, depthForEntityNow } from "../../../render/entities/geometry/worldToScreen.js";
import { depthForCombatReachOverlay } from "../../../render/entities/presentation/depthSort.js";
import type { VfxSystem } from "../../../vfx/system/index.js";
import { registerPendingSwing } from "../../../vfx/combat/melee/meleeConnect.js";
import { resolveMeleeSwingsInto } from "./meleeSwingEvents.js";
import type { DungeonSceneState } from "../orchestration/state.js";

export interface MeleeSwingSyncInput {
  readonly vfx: VfxSystem;
  readonly state: DungeonSceneState;
  readonly players: PlayerEntityView[];
  readonly nowMs: number;
  readonly context: RenderContext;
}

export function syncMeleeSwings(input: MeleeSwingSyncInput): void {
  const { vfx, state, players, nowMs } = input;
  const swings = resolveMeleeSwingsInto({ players, previousAttacking: state.attackFlags, spawns: state.swingSpawns, records: state.swingSpawnRecords, seen: state.swingSeen });
  for (const swing of swings) spawnSwing({ vfx, state, swing, nowMs });
  for (const player of players) followSwing({ vfx, player });
}

function spawnSwing(input: {
  readonly vfx: VfxSystem;
  readonly state: DungeonSceneState;
  readonly swing: ReturnType<typeof resolveMeleeSwingsInto>[number];
  readonly nowMs: number;
}): void {
  const { vfx, state, swing, nowMs } = input;
  const overlay = combatOverlayPosition({ worldX: swing.worldX, worldY: swing.worldY });
  swing.depth = depthForCombatReachOverlay({
    ...overlay,
    wielderDepth: depthForEntityNow(swing.worldX, swing.worldY),
    reachTiles: swing.profile.range,
  });
  vfx.spawnMeleeSwing({ id: swing.id, x: swing.worldX, y: swing.worldY, z: swing.z, angleRad: swing.angleRad, depth: swing.depth, tilePx: SCREEN_TILE_PX, nowMs, profile: swing.profile });
  registerPendingSwing(state.pendingSwings, { attackerId: swing.id, worldX: swing.worldX, worldY: swing.worldY, z: swing.z, angleRad: swing.angleRad, depth: swing.depth, startedAtMs: nowMs, profile: swing.profile });
}

function followSwing(input: {
  readonly vfx: VfxSystem;
  readonly player: MeleeSwingSyncInput["players"][number];
}): void {
  if (!input.player.attacking) return;
  input.vfx.updateMeleeSwingPosition({
    id: input.player.id,
    x: input.player.x,
    y: input.player.y,
    z: input.player.z,
  });
}
