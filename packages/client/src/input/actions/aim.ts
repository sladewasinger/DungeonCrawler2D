import { MAX_THROW_RANGE, type MoveInput } from "@dc2d/engine";
import type Phaser from "phaser";
import { screenDirToWorld } from "../controls/cameraRelative.js";
import { activeThrowableSlot } from "../gameplay/hotbar.js";
import { cursorWorldTile } from "../pointer/pointer.js";
import type { InputConnection, InputQueries, InputState } from "../controls/state.js";
import type { TouchInputState } from "../touch/index.js";
import { getViewOrientation } from "../../render/view/index.js";

export interface PointerFacingRequest {
  readonly move: MoveInput;
  readonly scene: Phaser.Scene;
  readonly conn: InputConnection;
  readonly tilePx: number;
}

export interface ThrowRequest {
  readonly scene: Phaser.Scene;
  readonly conn: InputConnection;
  readonly queries: InputQueries;
  readonly state: InputState;
  readonly touch: TouchInputState;
  readonly touchActive: boolean;
  readonly tilePx: number;
}

interface ThrowTarget {
  readonly slot: number;
  readonly x: number;
  readonly y: number;
}

interface CursorTargetRequest {
  readonly scene: Phaser.Scene;
  readonly conn: InputConnection;
  readonly slot: number;
  readonly tilePx: number;
}

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

function throwAt(conn: InputConnection, target: ThrowTarget): void {
  const { body } = conn;
  if (!body) return;
  const dx = target.x - body.x;
  const dy = target.y - body.y;
  if (conn.hotbar[target.slot] === "torch") return conn.throwTorch(dx, dy);
  conn.useSlot(target.slot, target.x, target.y);
}

function touchTarget(conn: InputConnection, slot: number, facing: { x: number; y: number }): ThrowTarget | undefined {
  if (!conn.body) return undefined;
  return { slot, x: conn.body.x + facing.x * MAX_THROW_RANGE, y: conn.body.y + facing.y * MAX_THROW_RANGE };
}

function cursorTarget(request: CursorTargetRequest): ThrowTarget {
  const { scene, conn, slot, tilePx } = request;
  const target = cursorWorldTile({ camera: scene.cameras.main, pointer: scene.input.activePointer, tilePx, heightAt: conn.heightAt });
  return { slot, x: target.x, y: target.y };
}

/** G throws the selected throwable toward touch facing or the desktop cursor. */
export function throwSelected(request: ThrowRequest): void {
  const { scene, conn, queries, state, touch, touchActive, tilePx } = request;
  const slot = activeThrowableSlot(state, conn, queries);
  if (slot === null || !conn.body) return;
  const target = touchActive
    ? touchTarget(conn, slot, screenDirToWorld(touch.lastFacing, getViewOrientation()))
    : cursorTarget({ scene, conn, slot, tilePx });
  if (target) throwAt(conn, target);
}
