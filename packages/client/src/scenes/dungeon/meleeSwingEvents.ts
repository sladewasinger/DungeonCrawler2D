// Detects "attack just started" per player id from PlayerEntityView.attacking (self's is
// selfCosmetics.ts's pulse; remote players' comes straight off the server's per-tick anim
// state) and resolves each swing's wedge-telegraph spawn parameters — the one seam both
// the self and remote presentation paths share, since PlayerEntityView.attackAngleRad
// already carries the right angle for either case (entityViews.ts).
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { depthForScreenY, worldToScreen } from "../../render/entities/worldToScreen.js";
import type { PlayerEntityView } from "../../render/entities/index.js";

/** Draws the wedge just under the wielder's feet-depth, so it reads as a ground telegraph rather than floating in front of the body. */
const WEDGE_DEPTH_BIAS = 0.05;

export interface MeleeSwingSpawn {
  id: string;
  worldX: number;
  worldY: number;
  /** The wielder's absolute height — the wedge anchors at their lifted feet. */
  z: number;
  angleRad: number;
  depth: number;
}

/** Returns the spawn parameters for every player whose `attacking` flipped false->true this frame; mutates `previousAttacking` to this frame's state and prunes ids no longer present. */
export function resolveMeleeSwings(players: readonly PlayerEntityView[], previousAttacking: Map<string, boolean>): MeleeSwingSpawn[] {
  return resolveMeleeSwingsInto({ players, previousAttacking, spawns: [], records: [], seen: new Set() });
}

export interface MeleeSwingFrame {
  readonly players: readonly PlayerEntityView[];
  readonly previousAttacking: Map<string, boolean>;
  readonly spawns: MeleeSwingSpawn[];
  readonly records: MeleeSwingSpawn[];
  readonly seen: Set<string>;
}

export function resolveMeleeSwingsInto(frame: MeleeSwingFrame): MeleeSwingSpawn[] {
  const { players, previousAttacking, spawns, records, seen } = frame;
  spawns.length = 0;
  seen.clear();
  for (const player of players) updateSwingRecord({ player, previousAttacking, spawns, records, seen });
  pruneMissingPlayers(previousAttacking, seen);
  return spawns;
}

function updateSwingRecord(input: {
  readonly player: PlayerEntityView; readonly previousAttacking: Map<string, boolean>;
  readonly spawns: MeleeSwingSpawn[]; readonly records: MeleeSwingSpawn[]; readonly seen: Set<string>;
}): void {
  const { player, previousAttacking, spawns, records, seen } = input;
  seen.add(player.id);
  if (player.attacking && !previousAttacking.get(player.id)) {
    const record = toSpawn(player, records[spawns.length]);
    records[spawns.length] = record; spawns.push(record);
  }
  previousAttacking.set(player.id, player.attacking);
}

function pruneMissingPlayers(previousAttacking: Map<string, boolean>, seen: Set<string>): void {
  for (const id of previousAttacking.keys()) if (!seen.has(id)) previousAttacking.delete(id);
}

function toSpawn(
  player: PlayerEntityView,
  target?: MeleeSwingSpawn,
): MeleeSwingSpawn {
  const spawn = target ?? {} as MeleeSwingSpawn;
  spawn.id = player.id;
  spawn.worldX = player.x;
  spawn.worldY = player.y;
  spawn.z = player.z;
  spawn.angleRad = player.attackAngleRad;
  const screen = worldToScreen(player.x, player.y);
  spawn.depth = depthForScreenY(screen.y - player.z * SCREEN_TILE_PX) - WEDGE_DEPTH_BIAS;
  return spawn;
}
