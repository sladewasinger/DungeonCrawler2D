import { MAX_THROW_RANGE } from "@dc2d/engine";
import type Phaser from "phaser";
import { getViewOrientation } from "../../render/view/index.js";
import { screenDirToWorld } from "../controls/cameraRelative.js";
import type {
  InputConnection,
  InputQueries,
  InputState,
} from "../controls/state.js";
import { kidFacingWorld } from "../controls/kidMode.js";
import { activeThrowableSlot } from "../gameplay/hotbar.js";
import { cursorWorldTile } from "../pointer/pointer.js";
import type { TouchInputState } from "../touch/index.js";

export interface WorldTarget {
  readonly x: number;
  readonly y: number;
}

export interface ResolvedThrowTarget extends WorldTarget {
  readonly slot: number;
}

export interface ThrowTargetRequest {
  readonly slot: number;
  readonly origin: WorldTarget;
  readonly pointerTarget?: WorldTarget | undefined;
  readonly fallbackDirection: WorldTarget;
  readonly maxRange?: number;
}

/** Pure target contract shared by preview and release: pointer when available,
 * facing fallback otherwise, with both paths clamped to the same maximum range. */
export function resolveThrowTarget(
  request: ThrowTargetRequest,
): ResolvedThrowTarget {
  const maxRange = request.maxRange ?? MAX_THROW_RANGE;
  const desired = request.pointerTarget ??
    facingTarget(request.origin, request.fallbackDirection, maxRange);
  const target = clampTarget(request.origin, desired, maxRange);
  return { slot: request.slot, ...target };
}

export interface CurrentThrowTargetRequest {
  readonly scene: Phaser.Scene;
  readonly conn: InputConnection;
  readonly queries: InputQueries;
  readonly state: InputState;
  readonly touch: TouchInputState;
  readonly touchActive: boolean;
  readonly tilePx: number;
  readonly touchPointer?: { x: number; y: number } | undefined;
}

export function resolveCurrentThrowTarget(
  request: CurrentThrowTargetRequest,
): ResolvedThrowTarget | null {
  const { conn, queries, state } = request;
  const slot = activeThrowableSlot(state, conn, queries);
  if (slot === null || !conn.body) return null;
  return resolveThrowTarget({
    slot,
    origin: conn.body,
    pointerTarget: currentPointerTarget(request),
    fallbackDirection: currentFallbackDirection(request),
  });
}

function currentPointerTarget(
  request: CurrentThrowTargetRequest,
): WorldTarget | undefined {
  if (request.touchActive && !request.touchPointer) return undefined;
  return cursorWorldTile({
    camera: request.scene.cameras.main,
    pointer: request.touchPointer ?? request.scene.input.activePointer,
    tilePx: request.tilePx,
    heightAt: request.conn.heightAt,
  });
}

function currentFallbackDirection(
  request: CurrentThrowTargetRequest,
): WorldTarget {
  if (request.touchActive) {
    return screenDirToWorld(request.touch.lastFacing, getViewOrientation());
  }
  if (request.state.kidMode.active) return kidFacingWorld(request.state.kidMode);
  return { x: 1, y: 0 };
}

function facingTarget(
  origin: WorldTarget,
  direction: WorldTarget,
  range: number,
): WorldTarget {
  const length = Math.hypot(direction.x, direction.y);
  if (length <= Number.EPSILON) return origin;
  return {
    x: origin.x + direction.x / length * range,
    y: origin.y + direction.y / length * range,
  };
}

function clampTarget(
  origin: WorldTarget,
  target: WorldTarget,
  maxRange: number,
): WorldTarget {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= maxRange || distance <= Number.EPSILON) return target;
  const scale = maxRange / distance;
  return { x: origin.x + dx * scale, y: origin.y + dy * scale };
}
