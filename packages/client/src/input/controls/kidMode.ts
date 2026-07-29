import type { MoveInput } from "@dc2d/engine";
import { getViewOrientation } from "../../render/view/index.js";
import {
  ASSISTED_TARGET_RANGE_TILES,
  assistedAttackDirection,
  triggerAssistedAttack,
} from "../actions/assistedAim.js";
import { screenDirToWorld } from "./cameraRelative.js";
import type {
  InputConnection,
  InputHooks,
  InputQueries,
  InputState,
  KidModeState,
} from "./state.js";

export const KID_TARGET_RANGE_TILES = ASSISTED_TARGET_RANGE_TILES;

export function createKidModeState(): KidModeState {
  return { active: false, facingX: 0, facingY: 1 };
}

export function updateKidFacing(state: KidModeState, move: MoveInput): void {
  if (move.moveX === 0 && move.moveY === 0) return;
  state.facingX = Math.sign(move.moveX);
  state.facingY = Math.sign(move.moveY);
}

export function kidFacingWorld(state: KidModeState): { x: number; y: number } {
  return screenDirToWorld(
    { x: state.facingX, y: state.facingY },
    getViewOrientation(),
  );
}

export function kidFacingTarget(
  state: KidModeState,
  body: { x: number; y: number },
  distance: number,
): { x: number; y: number } {
  const facing = kidFacingWorld(state);
  return {
    x: body.x + facing.x * distance,
    y: body.y + facing.y * distance,
  };
}

export function kidAttackDirection(
  state: InputState,
  conn: InputConnection,
  queries: InputQueries,
): { x: number; y: number } {
  return assistedAttackDirection(conn, queries, kidFacingWorld(state.kidMode));
}

interface KidAttackRequest {
  readonly state: InputState;
  readonly conn: InputConnection;
  readonly queries: InputQueries;
  readonly hooks: InputHooks;
  readonly nowMs: number;
}

export function attackInKidMode(request: KidAttackRequest): void {
  const { state, conn, queries, hooks, nowMs } = request;
  if (!state.kidMode.active || !conn.body || !conn.canAct) return;
  triggerAssistedAttack({
    state,
    conn,
    queries,
    hooks,
    fallbackDirection: kidFacingWorld(state.kidMode),
    nowMs,
    cooldownMs: queries.attackCooldownMs(conn.weapon),
  });
}
