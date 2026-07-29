import type { MoveInput } from "@dc2d/engine";
import type Phaser from "phaser";
import { cursorWorldTile } from "../pointer/pointer.js";
import type { InputConnection } from "../controls/state.js";
import {
  resolveCurrentThrowTarget,
  type CurrentThrowTargetRequest,
  type ResolvedThrowTarget,
} from "./throwTarget.js";

export interface PointerFacingRequest {
  readonly move: MoveInput;
  readonly scene: Phaser.Scene;
  readonly conn: InputConnection;
  readonly tilePx: number;
}

export type ThrowRequest = CurrentThrowTargetRequest;

/** Adds normalized cursor aim to the fixed-step movement sample. */
export function withPointerFacing(request: PointerFacingRequest): MoveInput {
  const { move, scene, conn, tilePx } = request;
  if (!conn.body) return move;
  const target = cursorWorldTile({ camera: scene.cameras.main, pointer: scene.input.activePointer, tilePx, heightAt: conn.heightAt });
  const dx = target.x - conn.body.x;
  const dy = target.y - conn.body.y;
  const length = Math.hypot(dx, dy);
  return length > 0.001 ? { ...move, faceX: dx / length, faceY: dy / length } : move;
}

export function throwAtResolvedTarget(
  conn: InputConnection,
  target: ResolvedThrowTarget,
): void {
  if (!conn.body) return;
  conn.useSlot(target.slot, target.x, target.y);
}

/** Throws an already-selected throwable through the same target used by preview. */
export function throwSelected(request: ThrowRequest): void {
  const target = resolveCurrentThrowTarget(request);
  if (target) throwAtResolvedTarget(request.conn, target);
}
