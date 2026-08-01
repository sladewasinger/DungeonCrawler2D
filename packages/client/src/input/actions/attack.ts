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
    nowMs,
    cooldownMs,
  } = request;
  if (nowMs < state.nextSwingAt) return;
  state.nextSwingAt = nowMs + cooldownMs;
  conn.attack(direction.x, direction.y);
  hooks.onSwing(presentationDirection.x, presentationDirection.y);
}
