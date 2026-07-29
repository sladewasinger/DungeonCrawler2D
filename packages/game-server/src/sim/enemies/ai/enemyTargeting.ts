import {
  hasTerrainLineOfSight,
  type Entity,
} from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";

interface TargetCandidate {
  readonly enemy: EnemySlot;
  readonly player: Entity;
  readonly distance: number;
  readonly retained: boolean;
}

export function assignVisibleEnemyTargets(
  sim: SimState,
  enemies: readonly EnemySlot[],
  players: readonly Entity[],
): ReadonlyMap<string, Entity> {
  const assignments = new Map<string, Entity>();
  const playerCounts = new Map<string, number>();
  const candidates = targetCandidates(sim, enemies, players);
  for (const candidate of candidates) {
    assignCandidate(candidate, assignments, playerCounts);
  }
  return assignments;
}

export function activeEnemiesNearPlayers(
  enemies: Iterable<EnemySlot>,
  players: readonly Entity[],
  radius: number,
): EnemySlot[] {
  return [...enemies].filter((enemy) =>
    enemy.entity.hp > 0 &&
    players.some((player) =>
      Math.abs(player.body.x - enemy.entity.body.x) < radius &&
      Math.abs(player.body.y - enemy.entity.body.y) < radius
    )
  );
}

function targetCandidates(
  sim: SimState,
  enemies: readonly EnemySlot[],
  players: readonly Entity[],
): TargetCandidate[] {
  const candidates: TargetCandidate[] = [];
  for (const enemy of enemies) {
    for (const player of players) {
      const candidate = visibleCandidate(sim, enemy, player);
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates.sort(compareCandidates);
}

function visibleCandidate(
  sim: SimState,
  enemy: EnemySlot,
  player: Entity,
): TargetCandidate | null {
  if (sim.effects.inSanctuary(player)) return null;
  const distance = Math.hypot(
    player.body.x - enemy.entity.body.x,
    player.body.y - enemy.entity.body.y,
  );
  if (distance > enemy.def.aggroRadius) return null;
  if (!hasTerrainLineOfSight({
    world: sim.world,
    from: enemy.entity.body,
    to: player.body,
    maximumHeightDifference:
      ENEMY_SIMULATION_TUNING.perception.maximumVisibleHeightDifference,
  })) return null;
  return {
    enemy,
    player,
    distance,
    retained: enemy.brain.targetId === player.id,
  };
}

function compareCandidates(a: TargetCandidate, b: TargetCandidate): number {
  if (a.retained !== b.retained) return a.retained ? -1 : 1;
  return a.distance - b.distance ||
    a.enemy.entity.id.localeCompare(b.enemy.entity.id) ||
    a.player.id.localeCompare(b.player.id);
}

function assignCandidate(
  candidate: TargetCandidate,
  assignments: Map<string, Entity>,
  playerCounts: Map<string, number>,
): void {
  if (assignments.has(candidate.enemy.entity.id)) return;
  const count = playerCounts.get(candidate.player.id) ?? 0;
  if (count >=
      ENEMY_SIMULATION_TUNING.perception.maximumAttackersPerPlayer) return;
  assignments.set(candidate.enemy.entity.id, candidate.player);
  playerCounts.set(candidate.player.id, count + 1);
}
