// Detects "attack just started" per player id from PlayerEntityView.attacking (self's is
// selfCosmetics.ts's pulse; remote players' comes straight off the server's per-tick anim
// state) and resolves each swing's wedge-telegraph spawn parameters — the one seam both
// the self and remote presentation paths share, since PlayerEntityView.attackAngleRad
// already carries the right angle for either case (entityViews.ts).
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { depthForScreenY, worldToScreen } from "../../../render/entities/geometry/worldToScreen.js";
import type {
  MonsterEntityView,
  PlayerEntityView,
} from "../../../render/entities/geometry/index.js";
import { monsterTrainingWeaponFor } from "../../../render/entities/visuals/spriteMap.js";
import { weaponProfileForId } from "../world/contentQueries.js";
import type { WeaponProfile } from "@dc2d/engine";

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
  profile: WeaponProfile;
}

/** Returns the spawn parameters for every player whose `attacking` flipped false->true this frame; mutates `previousAttacking` to this frame's state and prunes ids no longer present. */
export function resolveMeleeSwings(players: readonly PlayerEntityView[], previousAttacking: Map<string, boolean>): MeleeSwingSpawn[] {
  return resolveMeleeSwingsInto({ players, previousAttacking, spawns: [], records: [], seen: new Set() });
}

export interface MeleeSwingFrame {
  readonly players: readonly PlayerEntityView[];
  readonly monsters?: readonly MonsterEntityView[];
  readonly previousAttacking: Map<string, boolean>;
  readonly spawns: MeleeSwingSpawn[];
  readonly records: MeleeSwingSpawn[];
  readonly seen: Set<string>;
}

export function resolveMeleeSwingsInto(frame: MeleeSwingFrame): MeleeSwingSpawn[] {
  const { players, monsters = [], previousAttacking, spawns, records, seen } = frame;
  spawns.length = 0;
  seen.clear();
  for (const player of players) updateSwingRecord({ player, previousAttacking, spawns, records, seen });
  for (const monster of monsters) {
    updateTrainingSwingRecord({ monster, previousAttacking, spawns, records, seen });
  }
  pruneMissingPlayers(previousAttacking, seen);
  return spawns;
}

function updateTrainingSwingRecord(input: {
  readonly monster: MonsterEntityView; readonly previousAttacking: Map<string, boolean>;
  readonly spawns: MeleeSwingSpawn[]; readonly records: MeleeSwingSpawn[]; readonly seen: Set<string>;
}): void {
  const { monster, previousAttacking, spawns, records, seen } = input;
  const weaponId = monsterTrainingWeaponFor(monster.defId);
  if (!weaponId) return;
  seen.add(monster.id);
  const attacking = monster.anim === "attack";
  if (attacking && !previousAttacking.get(monster.id)) {
    const record = toTrainingSpawn(monster, weaponId, records[spawns.length]);
    records[spawns.length] = record;
    spawns.push(record);
  }
  previousAttacking.set(monster.id, attacking);
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
  spawn.profile = weaponProfileForId(player.weaponId);
  const screen = worldToScreen(player.x, player.y);
  spawn.depth = depthForScreenY(screen.y - player.z * SCREEN_TILE_PX) - WEDGE_DEPTH_BIAS;
  return spawn;
}

function toTrainingSpawn(
  monster: MonsterEntityView,
  weaponId: string,
  target?: MeleeSwingSpawn,
): MeleeSwingSpawn {
  const spawn = target ?? {} as MeleeSwingSpawn;
  spawn.id = monster.id;
  spawn.worldX = monster.x;
  spawn.worldY = monster.y;
  spawn.z = monster.z;
  spawn.angleRad = Math.atan2(monster.faceY ?? 0, monster.faceX);
  spawn.profile = weaponProfileForId(weaponId);
  const screen = worldToScreen(monster.x, monster.y);
  spawn.depth = depthForScreenY(screen.y - monster.z * SCREEN_TILE_PX) - WEDGE_DEPTH_BIAS;
  return spawn;
}
