import type { MiniBossArenaGate } from "@dc2d/engine";
import { MINI_BOSS_ARENA_RUNTIME_CONFIGURATION as CONFIG } from "./configuration.js";

export interface ArenaEntryProgress {
  readonly position: { readonly x: number; readonly y: number };
  readonly waypointIndex: number;
  readonly complete: boolean;
}

interface PointMove {
  readonly position: { readonly x: number; readonly y: number };
  readonly consumed: number;
  readonly reached: boolean;
}

const STEP_DISTANCE = CONFIG.entrySpeedTilesPerSecond *
  CONFIG.simulationTickSeconds;

export function advanceArenaEntry(
  position: { readonly x: number; readonly y: number },
  gate: MiniBossArenaGate,
  waypointIndex: number,
): ArenaEntryProgress {
  const waypoints = [gate.outside, gate.inside] as const;
  const target = waypoints[waypointIndex] ?? gate.inside;
  const first = moveToward(position, target, STEP_DISTANCE);
  if (!first.reached || waypointIndex > 0) {
    return progress(first.position, waypointIndex, waypointIndex > 0 && first.reached);
  }
  const remaining = STEP_DISTANCE - first.consumed;
  const second = moveToward(first.position, gate.inside, remaining);
  return progress(second.position, 1, second.reached);
}

function moveToward(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  budget: number,
): PointMove {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= CONFIG.endpointToleranceTiles || distance <= budget) {
    return { position: to, consumed: distance, reached: true };
  }
  const scale = budget / distance;
  return {
    position: { x: from.x + dx * scale, y: from.y + dy * scale },
    consumed: budget,
    reached: false,
  };
}

function progress(
  position: ArenaEntryProgress["position"],
  waypointIndex: number,
  complete: boolean,
): ArenaEntryProgress {
  return { position, waypointIndex, complete };
}
