import type { AdminMapEntity, Entity } from "@dc2d/engine";
import type { EnemySlot } from "../state/enemyState.js";
import type { SimState } from "../state/state.js";

export interface AdminMapDebugInput {
  readonly sim: SimState;
  readonly entity: Pick<Entity, "id" | "body" | "facing">;
}

export function adminMapDebugFields(
  input: AdminMapDebugInput,
): Pick<AdminMapEntity, "facing" | "blocking" | "debug"> {
  return {
    ...(input.entity.facing ? { facing: { ...input.entity.facing } } : {}),
    ...playerBlocking(input.sim, input.entity.id),
    ...enemyDebug(input.sim, input.entity.id, input.entity.body.z),
  };
}

function playerBlocking(
  sim: SimState,
  entityId: string,
): Pick<AdminMapEntity, "blocking"> {
  const player = sim.players.get(entityId);
  return player?.blocking ? { blocking: true } : {};
}

function enemyDebug(
  sim: SimState,
  entityId: string,
  fallbackZ: number,
): Pick<AdminMapEntity, "debug"> {
  const enemy = sim.enemies.get(entityId);
  if (!enemy) return {};
  return {
    debug: {
      behavior: behaviorForEnemy(enemy),
      ...targetForEnemy(sim, enemy),
      ...waypointForEnemy(enemy, fallbackZ),
    },
  };
}

function behaviorForEnemy(
  enemy: EnemySlot,
): "idle" | "engaged" | "pursuing" | "searching" {
  if (enemy.brain.targetId) return "engaged";
  if (enemy.brain.memoryPhase === "searching") return "searching";
  return enemy.brain.rememberedTarget ? "pursuing" : "idle";
}

function targetForEnemy(
  sim: SimState,
  enemy: EnemySlot,
): Pick<NonNullable<AdminMapEntity["debug"]>, "target"> {
  const target = enemy.brain.targetId
    ? sim.players.get(enemy.brain.targetId)?.entity.body
    : enemy.brain.rememberedTarget;
  return target ? { target: { x: target.x, y: target.y, z: target.z } } : {};
}

function waypointForEnemy(
  enemy: EnemySlot,
  fallbackZ: number,
): Pick<NonNullable<AdminMapEntity["debug"]>, "waypoint"> {
  const waypoint = enemy.searchState?.waypoint ?? enemy.rememberedRoute?.steps[0];
  return waypoint ? { waypoint: { x: waypoint.x, y: waypoint.y, z: fallbackZ } } : {};
}
