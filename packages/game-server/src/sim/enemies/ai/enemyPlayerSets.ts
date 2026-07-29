import { isSpawnProtected } from "../../spawnSafety/spawnSafety.js";
import type { EnemySlot, PlayerSlot, SimState } from "../../state/state.js";

export interface EnemyPlayerSets {
  readonly activePlayers: EnemySlot["entity"][];
  readonly targetablePlayers: EnemySlot["entity"][];
}

export function enemyPlayerSets(sim: SimState): EnemyPlayerSets {
  const sets = {
    activePlayers: [] as EnemySlot["entity"][],
    targetablePlayers: [] as EnemySlot["entity"][],
  };
  for (const slot of sim.players.values()) addEnemyVisiblePlayer(sim, slot, sets);
  return sets;
}

function addEnemyVisiblePlayer(
  sim: SimState,
  slot: PlayerSlot,
  sets: EnemyPlayerSets,
): void {
  if (!slot.connected || slot.entity.hp <= 0 ||
      isSpawnProtected(slot, sim.tickCount)) return;
  sets.activePlayers.push(slot.entity);
  if (slot.downedAtTick === null) sets.targetablePlayers.push(slot.entity);
}
