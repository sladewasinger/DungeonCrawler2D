/**
 * Pointer (mouse + touch) handling: hotbar taps, the touch action buttons, the
 * floating joystick's summon, armed throws, and weapon swings. Combat/use model:
 * LEFT CLICK (or the touch ATTACK button, aimed at the last move direction since
 * there's no mouse to aim with) swings the equipped weapon; number keys 1-9 or a
 * hotbar tap USE whatever is bound to that slot; a throwable slot arms a mouse
 * trajectory and the next world click throws it — desktop-only, touch has no aim.
 * Exception: an equipped throwable (a torch) always throws on primary attack instead
 * of swinging — desktop aims at the cursor, touch throws toward the last facing
 * (throwEquipped.ts, ASSUMPTION #42).
 */
import type Phaser from "phaser";
import { ATTACK_COOLDOWN_MS } from "@dc2d/engine";
import { screenDirToWorld } from "./cameraRelative.js";
import { activateHotbar, throwPreview } from "./hotbar.js";
import { getViewOrientation, pickTallestFirst, viewToWorld } from "../render/view/index.js";
import type { InputConnection, InputHooks, InputHud, InputQueries, InputState } from "./state.js";
import { equippedIsThrowable, equippedStackQty, throwDirToward } from "./throwEquipped.js";
import { beginStick, isInLowerLeftQuadrant, moveStick, endStick, pressButton, releaseAllForPointer } from "./touch/index.js";
import type { TouchInputState } from "./touch/index.js";

/**
 * The one method this module needs off a Phaser camera — kept as a minimal
 * structural interface (not `Phaser.Cameras.Scene2D.Camera`) so `cursorWorldTile`
 * is unit-testable with a plain object, no Phaser scene required.
 */
export interface WorldPointCamera {
  getWorldPoint(x: number, y: number): { x: number; y: number };
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
 * throw direction, the armed-throwable target) gets a genuine world-space point with no
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
export function cursorWorldTile(
  camera: WorldPointCamera,
  pointer: { x: number; y: number },
  tilePx: number,
  heightAt?: (wx: number, wy: number) => number,
): { x: number; y: number } {
  const world = camera.getWorldPoint(pointer.x, pointer.y);
  const viewTile = { x: world.x / tilePx, y: world.y / tilePx };
  const orientation = getViewOrientation();
  if (!heightAt) return viewToWorld(viewTile, orientation);
  const pick = pickTallestFirst(Math.floor(viewTile.x), Math.floor(viewTile.y), orientation, heightAt);
  if (pick.height === 0) return viewToWorld(viewTile, orientation);
  return viewToWorld({ x: viewTile.x, y: viewTile.y + pick.height }, orientation);
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
export function triggerAttack(state: InputState, conn: InputConnection, hooks: InputHooks, dx: number, dy: number, nowMs: number): void {
  if (nowMs < state.nextSwingAt) return;
  state.nextSwingAt = nowMs + ATTACK_COOLDOWN_MS;
  conn.attack(dx, dy);
  hooks.onSwing(dx, dy);
}

/** Throws the equipped throwable, or toasts instead of firing an intent that would land
 * with nothing left to throw — "throw-with-no-torch" (Epic 7.13 onboarding lane's
 * failure-feedback set), the one failure case the client can check without a round trip
 * since the stack count is already replicated (conn.inventory). */
function throwEquippedOrToast(conn: InputConnection, dirX: number, dirY: number): void {
  if (equippedStackQty(conn) <= 0) {
    conn.pushToast("Nothing left to throw");
    return;
  }
  conn.throwTorch(dirX, dirY);
}

/** Routes a single pointerdown through UI-hit-test → touch zones → armed-throw → weapon-swing, in that order. */
export function handlePointerDown(state: InputState, deps: PointerDeps, pointer: Phaser.Input.Pointer): void {
  const { conn, hud, tilePx, touch, touchActive, viewport, camera } = deps;
  if (!conn.body || !conn.canAct) return;

  // Clicks/taps on UI act on the UI — never swing or summon the stick through it.
  const uiHit = hud.hitTest(pointer.x, pointer.y);
  if (uiHit !== null) {
    handleUiHit(state, deps, uiHit, pointer.id);
    return;
  }
  if (pointer.rightButtonDown()) return; // reserved

  if (touchActive) {
    if (isInLowerLeftQuadrant(pointer.x, pointer.y, viewport.width, viewport.height)) {
      beginStick(touch, pointer.id, pointer.x, pointer.y);
    }
    return; // no mouse-aim swing/throw fallback in touch mode — the ATTACK button owns it
  }

  const cursorWorld = cursorWorldTile(camera, pointer, tilePx, conn.heightAt);

  // A torch (or any throwable) equipped as the weapon shows in-hand and click always
  // throws it — this takes priority over both the melee swing and the hotbar's
  // separate arm-then-click flow for a non-equipped throwable.
  if (equippedIsThrowable(conn, deps.queries)) {
    const dir = throwDirToward(conn.body, cursorWorld);
    throwEquippedOrToast(conn, dir.dirX, dir.dirY);
    return;
  }

  const preview = throwPreview(state, conn, deps.queries, cursorWorld);
  if (preview) {
    conn.useSlot(preview.slot, preview.targetX, preview.targetY);
    state.selectedThrowable = null;
    return;
  }

  const dx = cursorWorld.x - conn.body.x;
  const dy = cursorWorld.y - conn.body.y;
  triggerAttack(state, conn, deps.hooks, dx, dy, performance.now());
}

/** A tap that hit a HUD element: hotbar slot, one of the three touch buttons, the chat
 * toggle chip, or the inventory window (its own row/tab/button listeners handle the
 * click — "window:inventory" only exists so this never falls through to a world swing). */
function handleUiHit(state: InputState, deps: PointerDeps, uiHit: string, pointerId: number): void {
  const { conn, queries, hooks, touch } = deps;
  if (uiHit.startsWith("slot:")) {
    activateHotbar(state, conn, queries, Number(uiHit.slice(5)));
  } else if (uiHit === "touch:attack") {
    pressButton(touch, "attack", pointerId);
    // lastFacing is stored screen-relative (there's no mouse to aim with on touch) —
    // convert to world-space here, at the point of use, the same choke point
    // cursorWorldTile uses for mouse aim (LANE W2, docs/ASSUMPTIONS.md).
    const dir = screenDirToWorld(touch.lastFacing, getViewOrientation());
    if (equippedIsThrowable(conn, queries)) {
      throwEquippedOrToast(conn, dir.x, dir.y);
    } else {
      triggerAttack(state, conn, hooks, dir.x, dir.y, performance.now());
    }
  } else if (uiHit === "touch:jump") {
    pressButton(touch, "jump", pointerId);
  } else if (uiHit === "touch:interact") {
    pressButton(touch, "interact", pointerId);
    conn.pickup();
    conn.interact();
  } else if (uiHit === "chat:toggle") {
    hooks.onToggleChat();
  } else if (uiHit === "inventory:toggle") {
    hooks.onToggleInventory();
  }
}

/** Live drag tracking for the floating stick — routed from the scene's pointermove. */
export function handlePointerMove(touch: TouchInputState, pointer: Phaser.Input.Pointer): void {
  moveStick(touch, pointer.id, pointer.x, pointer.y);
}

/** Releases the stick (if this pointer owns it) and any buttons this pointer held — pointerup/pointerupoutside. */
export function handlePointerUp(touch: TouchInputState, pointer: Phaser.Input.Pointer): void {
  endStick(touch, pointer.id);
  releaseAllForPointer(touch, pointer.id);
}
