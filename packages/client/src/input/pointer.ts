/**
 * Pointer (mouse + touch) handling: hotbar taps, the touch action buttons, the
 * floating joystick's summon, armed throws, and weapon swings. Combat/use model:
 * LEFT CLICK (or the touch ATTACK button, aimed at the last move direction since
 * there's no mouse to aim with) swings the equipped weapon; number keys 1-9 or a
 * hotbar tap USE whatever is bound to that slot; a throwable slot arms a mouse
 * trajectory and the next world click throws it — desktop-only, touch has no aim.
 */
import type Phaser from "phaser";
import { ATTACK_COOLDOWN_MS } from "@dc2d/engine";
import { activateHotbar, throwPreview } from "./hotbar.js";
import type { InputConnection, InputHooks, InputHud, InputQueries, InputState } from "./state.js";
import { beginStick, isInLowerLeftQuadrant, moveStick, endStick, pressButton, releaseAllForPointer } from "./touch/index.js";
import type { TouchInputState } from "./touch/index.js";

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
}

/** Swings the equipped weapon at (dx,dy); the one cooldown-gated path both mouse-click and the touch ATTACK button use. */
export function triggerAttack(state: InputState, conn: InputConnection, hooks: InputHooks, dx: number, dy: number, nowMs: number): void {
  if (nowMs < state.nextSwingAt) return;
  state.nextSwingAt = nowMs + ATTACK_COOLDOWN_MS;
  conn.attack(dx, dy);
  hooks.onSwing(dx, dy);
}

/** Routes a single pointerdown through UI-hit-test → touch zones → armed-throw → weapon-swing, in that order. */
export function handlePointerDown(state: InputState, deps: PointerDeps, pointer: Phaser.Input.Pointer): void {
  const { conn, hud, tilePx, touch, touchActive, viewport } = deps;
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

  const preview = throwPreview(state, conn, deps.queries, { x: pointer.worldX / tilePx, y: pointer.worldY / tilePx });
  if (preview) {
    conn.useSlot(preview.slot, preview.targetX, preview.targetY);
    state.selectedThrowable = null;
    return;
  }

  const dx = pointer.worldX / tilePx - conn.body.x;
  const dy = pointer.worldY / tilePx - conn.body.y;
  triggerAttack(state, conn, deps.hooks, dx, dy, performance.now());
}

/** A tap that hit a HUD element: hotbar slot, one of the three touch buttons, or the chat toggle chip. */
function handleUiHit(state: InputState, deps: PointerDeps, uiHit: string, pointerId: number): void {
  const { conn, queries, hooks, touch } = deps;
  if (uiHit.startsWith("slot:")) {
    activateHotbar(state, conn, queries, Number(uiHit.slice(5)));
  } else if (uiHit === "touch:attack") {
    pressButton(touch, "attack", pointerId);
    triggerAttack(state, conn, hooks, touch.lastFacing.x, touch.lastFacing.y, performance.now());
  } else if (uiHit === "touch:jump") {
    pressButton(touch, "jump", pointerId);
  } else if (uiHit === "touch:interact") {
    pressButton(touch, "interact", pointerId);
    conn.pickup();
    conn.interact();
  } else if (uiHit === "chat:toggle") {
    hooks.onToggleChat();
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
