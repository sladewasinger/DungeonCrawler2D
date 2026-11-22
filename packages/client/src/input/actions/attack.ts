import { isRangedWeaponItem, itemRangedDef } from "../../ui/presentation/itemCatalog.js";
import type {
  InputConnection,
  InputHooks,
  InputState,
} from "../controls/state.js";

export interface AttackDirection {
  readonly x: number;
  readonly y: number;
}

interface AttackRequest {
  readonly state: InputState;
  readonly conn: InputConnection;
  readonly hooks: InputHooks;
  readonly direction: AttackDirection;
  readonly presentationDirection?: AttackDirection;
  readonly drawRatio?: number;
  readonly nowMs: number;
  readonly cooldownMs: number;
}

export function triggerAttack(request: AttackRequest): void {
  const {
    state,
    conn,
    hooks,
    direction,
    presentationDirection = direction,
    drawRatio,
    nowMs,
    cooldownMs,
  } = request;
  if (nowMs < state.nextSwingAt) return;
  state.nextSwingAt = nowMs + cooldownMs;
  if (drawRatio === undefined) conn.attack(direction.x, direction.y);
  else conn.attack(direction.x, direction.y, drawRatio);
  hooks.onSwing(presentationDirection.x, presentationDirection.y);
}

export function tryStartBowDraw(
  state: InputState,
  weapon: string | null,
  nowMs: number,
): boolean {
  if (!weapon || !isRangedWeaponItem(weapon)) return false;
  if (nowMs >= state.nextSwingAt) state.bowDrawStartedAtMs = nowMs;
  return true;
}

export function consumeBowDrawRatio(
  state: InputState,
  conn: InputConnection,
  nowMs: number,
): number | null {
  const startedAt = state.bowDrawStartedAtMs;
  state.bowDrawStartedAtMs = null;
  return computeBowDrawRatio(startedAt, conn, nowMs);
}

export function currentBowDrawRatio(
  state: InputState,
  conn: InputConnection,
  nowMs: number,
): number | null {
  return computeBowDrawRatio(state.bowDrawStartedAtMs, conn, nowMs);
}

function computeBowDrawRatio(
  startedAt: number | null | undefined,
  conn: InputConnection,
  nowMs: number,
): number | null {
  if (startedAt === null || startedAt === undefined) return null;
  const ranged = itemRangedDef(conn.weapon);
  if (!conn.body || !conn.canAct || !ranged) return null;
  return Math.max(0.2, Math.min(1, (nowMs - startedAt) / ranged.maxDrawMs));
}
