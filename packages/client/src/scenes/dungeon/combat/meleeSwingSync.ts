import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import type { PlayerEntityView, RenderContext } from "../../../render/entities/geometry/index.js";
import { combatOverlayPosition, depthForEntityNow } from "../../../render/entities/geometry/worldToScreen.js";
import { depthForAdjacentTerrainOverlay } from "../../../render/entities/presentation/depthSort.js";
import type { VfxSystem } from "../../../vfx/system/index.js";
import { registerPendingSwing } from "../../../vfx/combat/meleeConnect.js";
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
  const { vfx, state, players, nowMs, context } = input;
  const swings = resolveMeleeSwingsInto({ players, previousAttacking: state.attackFlags, spawns: state.swingSpawns, records: state.swingSpawnRecords, seen: state.swingSeen });
  for (const swing of swings) spawnSwing({ vfx, state, swing, nowMs, context });
}

function spawnSwing(input: {
  readonly vfx: VfxSystem;
  readonly state: DungeonSceneState;
  readonly swing: ReturnType<typeof resolveMeleeSwingsInto>[number];
  readonly nowMs: number;
  readonly context: RenderContext;
}): void {
  const { vfx, state, swing, nowMs, context } = input;
  const overlay = combatOverlayPosition({ worldX: swing.worldX, worldY: swing.worldY, z: swing.z, world: context.world });
  swing.depth = depthForAdjacentTerrainOverlay(overlay.wielderViewY, depthForEntityNow(swing.worldX, swing.worldY), overlay.screenSouthFloorHigher);
  vfx.spawnMeleeSwing({ id: swing.id, x: swing.worldX, y: swing.worldY, z: swing.z, angleRad: swing.angleRad, depth: swing.depth, tilePx: SCREEN_TILE_PX, nowMs });
  registerPendingSwing(state.pendingSwings, { attackerId: swing.id, worldX: swing.worldX, worldY: swing.worldY, z: swing.z, angleRad: swing.angleRad, depth: swing.depth, startedAtMs: nowMs });
}
