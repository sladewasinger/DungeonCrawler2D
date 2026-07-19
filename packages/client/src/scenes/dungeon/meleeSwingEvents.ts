// Detects "attack just started" per player id from PlayerEntityView.attacking (self's is
// selfCosmetics.ts's pulse; remote players' comes straight off the server's per-tick anim
// state) and resolves each swing's wedge-telegraph spawn parameters — the one seam both
// the self and remote presentation paths share, since PlayerEntityView.attackAngleRad
// already carries the right angle for either case (entityViews.ts).
import { depthForEntity } from "../../render/entities/depthSort.js";
import type { PlayerEntityView } from "../../render/entities/index.js";

/** Draws the wedge just under the wielder's feet-depth, so it reads as a ground telegraph rather than floating in front of the body. */
const WEDGE_DEPTH_BIAS = 0.05;

export interface MeleeSwingSpawn {
  readonly id: string;
  readonly worldX: number;
  readonly worldY: number;
  readonly angleRad: number;
  readonly depth: number;
}

/** Returns the spawn parameters for every player whose `attacking` flipped false->true this frame; mutates `previousAttacking` to this frame's state and prunes ids no longer present. */
export function resolveMeleeSwings(players: readonly PlayerEntityView[], previousAttacking: Map<string, boolean>): MeleeSwingSpawn[] {
  const spawns: MeleeSwingSpawn[] = [];
  const seen = new Set<string>();
  for (const player of players) {
    seen.add(player.id);
    const wasAttacking = previousAttacking.get(player.id) ?? false;
    if (player.attacking && !wasAttacking) spawns.push(toSpawn(player));
    previousAttacking.set(player.id, player.attacking);
  }
  for (const id of previousAttacking.keys()) if (!seen.has(id)) previousAttacking.delete(id);
  return spawns;
}

function toSpawn(player: PlayerEntityView): MeleeSwingSpawn {
  return { id: player.id, worldX: player.x, worldY: player.y, angleRad: player.attackAngleRad, depth: depthForEntity(player.y) - WEDGE_DEPTH_BIAS };
}
