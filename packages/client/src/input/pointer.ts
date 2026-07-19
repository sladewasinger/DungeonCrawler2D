/**
 * Pointer (mouse) handling: hotbar clicks, armed throws, and weapon swings.
 * Combat/use model: LEFT CLICK swings the equipped weapon; number keys 1-9
 * USE whatever is bound to that hotbar slot; a throwable slot arms a mouse
 * trajectory and the next world click throws it.
 */
import type Phaser from "phaser";
import { ATTACK_COOLDOWN_MS } from "@dc2d/engine";
import { activateHotbar, throwPreview } from "./hotbar.js";
import type { InputConnection, InputHooks, InputHud, InputQueries, InputState } from "./state.js";

export interface PointerDeps {
  conn: InputConnection;
  hud: InputHud;
  queries: InputQueries;
  hooks: InputHooks;
  /** World px per tile — how the pointer's screen position maps to tile-space intents. */
  tilePx: number;
}

/** Routes a single pointerdown through UI-hit-test → armed-throw → weapon-swing, in that order. */
export function handlePointerDown(state: InputState, deps: PointerDeps, pointer: Phaser.Input.Pointer): void {
  const { conn, hud, queries, hooks, tilePx } = deps;
  if (!conn.body || !conn.canAct) return;

  // Clicks on UI act on the UI — never swing through the hotbar.
  const uiHit = hud.hitTest(pointer.x, pointer.y);
  if (uiHit !== null) {
    if (uiHit.startsWith("slot:")) activateHotbar(state, conn, queries, Number(uiHit.slice(5)));
    return;
  }
  if (pointer.rightButtonDown()) return; // reserved

  const preview = throwPreview(state, conn, queries, {
    x: pointer.worldX / tilePx,
    y: pointer.worldY / tilePx,
  });
  if (preview) {
    conn.useSlot(preview.slot, preview.targetX, preview.targetY);
    state.selectedThrowable = null;
    return;
  }

  const now = performance.now();
  if (now < state.nextSwingAt) return;
  state.nextSwingAt = now + ATTACK_COOLDOWN_MS;
  const dx = pointer.worldX / tilePx - conn.body.x;
  const dy = pointer.worldY / tilePx - conn.body.y;
  conn.attack(dx, dy);
  hooks.onSwing(dx, dy);
}
