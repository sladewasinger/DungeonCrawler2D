import { isRangedWeaponItem, itemRangedDef } from "../../ui/presentation/itemCatalog.js";
import type {
  InputConnection,
  InputHooks,
  InputState,
  ThrowPreview,
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
  if (startedAt === null || startedAt === undefined) return null;
  const ranged = itemRangedDef(conn.weapon);
  if (!conn.body || !conn.canAct || !ranged) return null;
  return Math.max(0.2, Math.min(1, (nowMs - startedAt) / ranged.maxDrawMs));
}

export function resolveBowDrawPreview(input: {
  state: InputState;
  conn: InputConnection;
  cursor: { x: number; y: number };
  nowMs: number;
}): ThrowPreview | null {
  const { state, conn, cursor, nowMs } = input;
  const startedAt = state.bowDrawStartedAtMs;
  const ranged = itemRangedDef(conn.weapon);
  if (startedAt === null || startedAt === undefined || !conn.body || !ranged) return null;
  const ratio = Math.max(0.2, Math.min(1, (nowMs - startedAt) / ranged.maxDrawMs));
  const dx = cursor.x - conn.body.x;
  const dy = cursor.y - conn.body.y;
  const len = Math.hypot(dx, dy) || 1;
  const range = Math.max(3, ranged.maxRange * (0.4 + 0.6 * ratio));
  return {
    slot: state.selectedSlot ?? 0,
    targetX: conn.body.x + (dx / len) * range,
    targetY: conn.body.y + (dy / len) * range,
  };
}
