/**
 * Pointer handling for hotbar taps, touch action buttons, the floating joystick,
 * and weapon swings. Primary attack always uses the equipped weapon. Hotbar
 * throwables and consumables are handled by their dedicated keyboard actions.
 */
import type Phaser from "phaser";
import { getViewOrientation, pickTallestFirst, viewToWorld } from "../../render/view/index.js";
import type { InputConnection, InputHooks, InputHud, InputQueries, InputState } from "../controls/state.js";
import { moveStick, endStick, releaseAllForPointer } from "../touch/index.js";
import type { TouchInputState } from "../touch/index.js";
import { attackAtPointer, handlePointerHudHit, handlePointerSecondaryButton, handleTouchPointer } from "../actions/pointerActions.js";

/**
 * The one method this module needs off a Phaser camera — kept as a minimal
 * structural interface (not `Phaser.Cameras.Scene2D.Camera`) so `cursorWorldTile`
 * is unit-testable with a plain object, no Phaser scene required.
 */
export interface WorldPointCamera {
  getWorldPoint(x: number, y: number): { x: number; y: number };
}

export interface CursorWorldTileOptions {
  camera: WorldPointCamera;
  pointer: { x: number; y: number };
  tilePx: number;
  heightAt?: ((wx: number, wy: number) => number) | undefined;
}

/**
 * Resolves a screen-space pointer to real WORLD tile coordinates through the given
 * camera's own transform, in tile units (world px / tilePx). Deliberately never
 * reads `pointer.worldX`/`worldY` — see the doc comment on the `camera` field of
 * `PointerDeps` below for why that shared Pointer property lies whenever the
 * parallel HudScene's camera has hit-tested more recently than the game camera.
 *
 * The camera's own "world" is really VIEW-pixel space (every draw call routes through
 * worldToScreen, which the game camera centers on) — this is the mouse-aim choke point
 * LANE W2 routes through viewToWorld (docs/ASSUMPTIONS.md) so every caller (attack aim,
 * throw targeting) gets a genuine world-space point with no
 * per-call-site change needed. At orientation 0, viewToWorld is the identity, so this is
 * byte-identical to the pre-rotation behavior this function's own tests already lock.
 *
 * WAVE E3 (docs/ELEVATION-PROJECTION.md section 4): when `heightAt` is supplied, the
 * screen point is first resolved tallest-first (`pickTallestFirst`) so aiming at a
 * raised cap's SHIFTED screen position (a jump-attack target, an armed torch's throw
 * spot) lands on the platform actually drawn there, not the flat cell a naive mapping
 * would guess. Only the integer view-tile part feeds the search; the picked height then
 * shifts the CONTINUOUS view point before the final `viewToWorld`, preserving the
 * sub-tile precision aim direction needs. Omitting `heightAt` (or the flat h=0 fallback)
 * is byte-identical to the pre-E3 behavior this function's own tests already lock.
 */
export function cursorWorldTile(options: CursorWorldTileOptions | WorldPointCamera, ...legacy: unknown[]): { x: number; y: number } {
  const { camera, pointer, tilePx, heightAt } = "camera" in options
    ? options
    : { camera: options, pointer: legacy[0] as { x: number; y: number }, tilePx: legacy[1] as number, heightAt: legacy[2] as ((wx: number, wy: number) => number) | undefined };
  const world = camera.getWorldPoint(pointer.x, pointer.y);
  const viewTile = { x: world.x / tilePx, y: world.y / tilePx };
  const orientation = getViewOrientation();
  if (!heightAt) return viewToWorld(viewTile, orientation);
  const pick = pickTallestFirst(Math.floor(viewTile.x), Math.floor(viewTile.y), orientation, heightAt);
  if (pick.height === 0) return viewToWorld(viewTile, orientation);
  return viewToWorld({ x: viewTile.x, y: viewTile.y + pick.height }, orientation);
}

export interface AttackRequest {
  state: InputState;
  conn: InputConnection;
  hooks: InputHooks;
  dx: number;
  dy: number;
  nowMs: number;
  cooldownMs: number;
}

export interface PointerDeps {
  conn: InputConnection;
  hud: InputHud;
  queries: InputQueries;
  hooks: InputHooks;
  /** World px per tile — how the pointer's screen position maps to tile-space intents. */
  tilePx: number;
  touch: TouchInputState;
  touchActive: boolean;
  sendMovementEdge(): void;
  performContextAction(): void;
  throwSelected(): void;
  viewport: { width: number; height: number };
  /**
   * The dungeon scene's own camera, transformed through explicitly (`getWorldPoint`)
   * instead of trusting the shared `pointer.worldX/worldY`: Phaser's Pointer.updateWorldPoint
   * doc warns those values "will be automatically replaced the moment the Pointer is
   * updated by an input event... should be used immediately" — with HudScene's parallel,
   * un-zoomed, unscrolled camera also live, it reliably clobbers a scrolled/zoomed game
   * camera's value whenever HudScene's InputPlugin hit-tests last (docs Epic 7.12 audit).
   */
  camera: WorldPointCamera;
}

/** Swings the equipped weapon at (dx,dy); the one cooldown-gated path both mouse-click and the touch ATTACK button use. */
export function triggerAttack({ state, conn, hooks, dx, dy, nowMs, cooldownMs }: AttackRequest): void {
  if (nowMs < state.nextSwingAt) return;
  state.nextSwingAt = nowMs + cooldownMs;
  conn.attack(dx, dy);
  hooks.onSwing(dx, dy);
}

/** Routes a pointerdown through UI hit testing, touch zones, then weapon swing. */
export function handlePointerDown(state: InputState, deps: PointerDeps, pointer: Phaser.Input.Pointer): void {
  const { conn, hud, tilePx, touch, touchActive, viewport, camera } = deps;
  if (!conn.body || !conn.canAct) return;
  if (handlePointerHudHit({ state, deps, pointer, hud })) return;
  if (handlePointerSecondaryButton(deps, pointer)) return;
  if (handleTouchPointer({ touchActive, touch, pointer, viewport })) return;
  attackAtPointer({ state, deps, pointer, camera, tilePx });
}


/** Live drag tracking for the floating stick — routed from the scene's pointermove. */
export function handlePointerMove(
  touch: TouchInputState,
  pointer: Phaser.Input.Pointer,
): void {
  moveStick(touch, { pointerId: pointer.id, x: pointer.x, y: pointer.y });
}

/** Releases the stick (if this pointer owns it) and any buttons this pointer held — pointerup/pointerupoutside. */
export interface PointerReleaseOptions {
  touch: TouchInputState;
  pointer: Phaser.Input.Pointer;
  onInteractReleased?: () => void;
  onMovementEdge?: () => void;
}

export function handlePointerUp(options: PointerReleaseOptions | TouchInputState, ...legacy: unknown[]): void {
  const { touch, pointer, onInteractReleased = () => {}, onMovementEdge = () => {} } = "touch" in options
    ? options
    : { touch: options, pointer: legacy[0] as Phaser.Input.Pointer, onInteractReleased: legacy[1] as (() => void) | undefined, onMovementEdge: legacy[2] as (() => void) | undefined };
  const releasedInteract = touch.buttons.interact === pointer.id;
  endStick(touch, pointer.id);
  releaseAllForPointer(touch, pointer.id);
  if (releasedInteract) onInteractReleased();
  onMovementEdge();
}
