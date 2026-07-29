import { screenDirToWorld } from "../controls/cameraRelative.js";
import { activateHotbar } from "../gameplay/hotbar.js";
import { cursorWorldTile, triggerAttack, type PointerDeps, type WorldPointCamera } from "../pointer/pointer.js";
import { getViewOrientation } from "../../render/view/index.js";
import { beginStick, isInLowerLeftQuadrant, pressButton } from "../touch/index.js";
import type { InputConnection, InputHooks, InputHud, InputState } from "../controls/state.js";
import type Phaser from "phaser";
import type { TouchInputState } from "../touch/index.js";
import { attackInKidMode } from "../controls/kidMode.js";

interface PointerHudHitRequest {
  state: InputState;
  deps: PointerDeps;
  pointer: Phaser.Input.Pointer;
  hud: InputHud;
}

export function handlePointerHudHit({ state, deps, pointer, hud }: PointerHudHitRequest): boolean {
  const uiHit = hud.hitTest(pointer.x, pointer.y);
  if (uiHit === null) return false;
  handleUiHit({ state, deps, uiHit, pointerId: pointer.id });
  return true;
}

export function handlePointerSecondaryButton(deps: PointerDeps, pointer: Phaser.Input.Pointer): boolean {
  if (!pointer.rightButtonDown()) return false;
  deps.sendMovementEdge();
  return true;
}

interface TouchPointerRequest {
  touchActive: boolean;
  touch: TouchInputState;
  pointer: Phaser.Input.Pointer;
  viewport: { width: number; height: number };
}

export function handleTouchPointer({ touchActive, touch, pointer, viewport }: TouchPointerRequest): boolean {
  if (!touchActive) return false;
  if (isInLowerLeftQuadrant(pointer, viewport)) beginStick(touch, { pointerId: pointer.id, x: pointer.x, y: pointer.y });
  return true;
}

interface PointerAttackRequest {
  state: InputState;
  deps: PointerDeps;
  pointer: Phaser.Input.Pointer;
  camera: WorldPointCamera;
  tilePx: number;
}

export function attackAtPointer({ state, deps, pointer, camera, tilePx }: PointerAttackRequest): void {
  const { conn } = deps;
  if (state.kidMode.active) {
    attackInKidMode({
      state,
      conn,
      queries: deps.queries,
      hooks: deps.hooks,
      nowMs: performance.now(),
    });
    return;
  }
  const cursorWorld = cursorWorldTile({ camera, pointer, tilePx, heightAt: conn.heightAt });
  const dx = cursorWorld.x - conn.body!.x;
  const dy = cursorWorld.y - conn.body!.y;
  triggerAttack({ state, conn, hooks: deps.hooks, dx, dy, nowMs: performance.now(), cooldownMs: deps.queries.attackCooldownMs(conn.weapon) });
}

interface UiHitRequest {
  state: InputState;
  deps: PointerDeps;
  uiHit: string;
  pointerId: number;
}

function handleUiHit({ state, deps, uiHit, pointerId }: UiHitRequest): void {
  if (uiHit.startsWith("slot:")) return activateHotbar(state, deps.conn, Number(uiHit.slice(5)));
  const action = uiHitActions({ state, deps, pointerId });
  action?.[uiHit]?.();
}

interface UiHitActionsRequest {
  state: InputState;
  deps: PointerDeps;
  pointerId: number;
}

function uiHitActions({ state, deps, pointerId }: UiHitActionsRequest): Record<string, () => void> {
  const { conn, queries, hooks, touch } = deps;
  return {
    "touch:attack": () => attackInTouchFacing({ state, conn, hooks, touch, cooldownMs: queries.attackCooldownMs(conn.weapon) }),
    "touch:block": () => pressAndMove(deps, "block", pointerId),
    "touch:jump": () => pressAndMove(deps, "jump", pointerId),
    "touch:interact": () => pressAndInteract(deps, pointerId),
    "touch:throw": deps.throwSelected,
    "chat:toggle": hooks.onToggleChat,
    "inventory:toggle": hooks.onToggleInventory,
  };
}

interface TouchAttackRequest {
  state: InputState;
  conn: InputConnection;
  hooks: InputHooks;
  touch: TouchInputState;
  cooldownMs: number;
}

function attackInTouchFacing({ state, conn, hooks, touch, cooldownMs }: TouchAttackRequest): void {
  const dir = screenDirToWorld(touch.lastFacing, getViewOrientation());
  triggerAttack({ state, conn, hooks, dx: dir.x, dy: dir.y, nowMs: performance.now(), cooldownMs });
}

function pressAndMove(deps: PointerDeps, button: "block" | "jump", pointerId: number): void {
  pressButton(deps.touch, button, pointerId);
  deps.sendMovementEdge();
}

function pressAndInteract(deps: PointerDeps, pointerId: number): void {
  pressButton(deps.touch, "interact", pointerId);
  deps.performContextAction();
}
