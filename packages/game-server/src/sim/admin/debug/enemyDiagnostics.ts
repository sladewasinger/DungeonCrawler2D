import type { EnemySlot } from "../../state/enemyState.js";
import {
  adminDebugFlagEnabled,
  type AdminEntityDebug,
  type AdminMapDebugInput,
} from "../adminMapDebugTypes.js";

const MAX_NAVIGATION_STEPS = 24;

export function adminEnemyDebug(
  input: AdminMapDebugInput,
): Pick<AdminEntityDebug, "behavior" | "lineOfSight" | "search" | "navigation"> {
  if (!enemyDiagnosticsEnabled(input)) return {};
  const enemy = input.sim.enemies.get(input.entity.id);
  if (!enemy) return {};
  return {
    ...(adminDebugFlagEnabled(input, "behavior")
      ? { behavior: behaviorForEnemy(enemy) }
      : {}),
    ...(adminDebugFlagEnabled(input, "lineOfSight")
      ? lineOfSightDebug(input, enemy)
      : {}),
    ...(adminDebugFlagEnabled(input, "search") ? searchDebug(enemy) : {}),
    ...(adminDebugFlagEnabled(input, "navigation")
      ? navigationDebug(enemy, input.entity.body.z)
      : {}),
  };
}

function enemyDiagnosticsEnabled(input: AdminMapDebugInput): boolean {
  return adminDebugFlagEnabled(input, "behavior") ||
    adminDebugFlagEnabled(input, "lineOfSight") ||
    adminDebugFlagEnabled(input, "search") ||
    adminDebugFlagEnabled(input, "navigation");
}

function behaviorForEnemy(
  enemy: EnemySlot,
): "idle" | "engaged" | "pursuing" | "searching" {
  if (enemy.brain.targetId) return "engaged";
  if (enemy.brain.memoryPhase === "searching") return "searching";
  return enemy.brain.rememberedTarget ? "pursuing" : "idle";
}

function lineOfSightDebug(
  input: AdminMapDebugInput,
  enemy: EnemySlot,
): Pick<AdminEntityDebug, "lineOfSight"> {
  const targetId = enemy.brain.targetId;
  const target = targetId ? input.sim.players.get(targetId)?.entity.body : undefined;
  return target ? { lineOfSight: toDebugPoint(target) } : {};
}

function searchDebug(enemy: EnemySlot): Pick<AdminEntityDebug, "search"> {
  if (enemy.brain.memoryPhase !== "searching" || !enemy.searchState) return {};
  const { anchor, waypoint } = enemy.searchState;
  const target = enemy.brain.rememberedTarget;
  return {
    search: {
      anchor: toDebugPoint(anchor),
      ...(target ? { target: toDebugPoint(target) } : {}),
      ...(waypoint ? { waypoint: toDebugPoint(waypoint) } : {}),
    },
  };
}

function navigationDebug(
  enemy: EnemySlot,
  fallbackZ: number,
): Pick<AdminEntityDebug, "navigation"> {
  const steps = enemy.rememberedRoute?.steps.slice(0, MAX_NAVIGATION_STEPS) ?? [];
  if (steps.length === 0) return {};
  return {
    navigation: {
      path: steps.map((step) => ({ x: step.x + 0.5, y: step.y + 0.5, z: fallbackZ })),
    },
  };
}

function toDebugPoint(point: { readonly x: number; readonly y: number; readonly z: number }) {
  return { x: point.x, y: point.y, z: point.z };
}
