import type { SimState } from "../state/state.js";
import type { AdminMutationResult } from "./adminControls.js";

export function killAdminEnemies(
  sim: SimState,
  centerPlayerId: string,
  radius: number,
): AdminMutationResult {
  const slot = sim.players.get(centerPlayerId);
  const center = slot?.entity.body;
  if (!center || !slot) return { ok: false, code: "player_not_found" };
  let killed = 0;
  for (const enemy of sim.enemies.values()) {
    if (!enemyInRadius({ x: enemy.entity.body.x, y: enemy.entity.body.y }, center, radius)) continue;
    enemy.entity.hp = 0;
    killed++;
  }
  slot.outbox.push({ t: "toast", msg: `An admin cleared ${killed} nearby enemies.` });
  return { ok: true, message: `marked ${killed} enemies for resolution` };
}

function enemyInRadius(point: { x: number; y: number }, center: { x: number; y: number }, radius: number): boolean {
  return Math.hypot(point.x - center.x, point.y - center.y) <= radius;
}
