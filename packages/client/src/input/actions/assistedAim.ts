import type {
  InputConnection,
  InputHooks,
  InputQueries,
  InputState,
} from "../controls/state.js";
import {
  triggerAttack,
  type AttackDirection,
} from "./attack.js";

export const ASSISTED_TARGET_RANGE_TILES = 4;

export function assistedAimActive(
  touchActive: boolean,
  kidModeActive: boolean,
): boolean {
  return touchActive || kidModeActive;
}

export function assistedAttackDirection(
  conn: InputConnection,
  queries: InputQueries,
  fallbackDirection: AttackDirection,
): AttackDirection {
  return queries.nearestEnemyDirection(
    conn,
    ASSISTED_TARGET_RANGE_TILES,
  ) ?? fallbackDirection;
}

interface AssistedAttackRequest {
  readonly state: InputState;
  readonly conn: InputConnection;
  readonly queries: InputQueries;
  readonly hooks: InputHooks;
  readonly fallbackDirection: AttackDirection;
  readonly nowMs: number;
  readonly cooldownMs: number;
}

export function triggerAssistedAttack(request: AssistedAttackRequest): void {
  const { conn, queries, fallbackDirection } = request;
  if (!conn.body || !conn.canAct) return;
  const direction = assistedAttackDirection(conn, queries, fallbackDirection);
  triggerAttack({ ...request, direction });
}
