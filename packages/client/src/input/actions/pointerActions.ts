import { screenDirToWorld } from "../controls/cameraRelative.js";
import { activateHotbar } from "../gameplay/hotbar.js";
import { cursorWorldTile, type PointerDeps, type WorldPointCamera } from "../pointer/pointer.js";
import { getViewOrientation } from "../../render/view/index.js";
import { beginStick, isInLowerLeftQuadrant, pressButton } from "../touch/index.js";
import type { InputConnection, InputHooks, InputHud, InputQueries, InputState } from "../controls/state.js";
import type Phaser from "phaser";
import type { TouchInputState } from "../touch/index.js";
import { attackInKidMode } from "../controls/kidMode.js";
import { triggerAssistedAttack } from "./assistedAim.js";
import { triggerAttack } from "./attack.js";

export type { PointerDeps } from "../pointer/pointer.js";

interface PointerHudHitRequest { state: InputState; deps: PointerDeps; pointer: Phaser.Input.Pointer; hud: InputHud; }

export function handlePointerHudHit({ state, deps, pointer, hud }: PointerHudHitRequest): boolean {
  const uiHit = hud.hitTest(pointer.x, pointer.y);
  if (uiHit === null) return false;
  handleUiHit({ state, deps, uiHit, pointerId: pointer.id, pointer });
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
  state: InputState; deps: PointerDeps; pointer: Phaser.Input.Pointer; camera: WorldPointCamera;
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
  const aim = pointerAim({ deps, pointer, camera, tilePx });
  triggerAttack({
    state,
    conn,
    hooks: deps.hooks,
    direction: aim.networkDirection,
    ...(aim.presentationDirection
      ? { presentationDirection: aim.presentationDirection }
      : {}),
    nowMs: performance.now(),
    cooldownMs: deps.queries.attackCooldownMs(conn.weapon),
  });
}

function pointerAim(request: {
  readonly deps: PointerDeps;
  readonly pointer: Phaser.Input.Pointer;
  readonly camera: WorldPointCamera;
  readonly tilePx: number;
}): {
  readonly networkDirection: { readonly x: number; readonly y: number };
  readonly presentationDirection?: { readonly x: number; readonly y: number };
} {
  const { deps, pointer, camera, tilePx } = request;
  const reflectionAim = deps.queries.projectileReflectionAim?.(deps.conn, {
    pointerView: pointerViewTile(camera, pointer, tilePx),
    orientation: getViewOrientation(),
  });
  if (reflectionAim) return reflectionAim;
  const cursorWorld = cursorWorldTile({ camera, pointer, tilePx, heightAt: deps.conn.heightAt });
  return {
    networkDirection: { x: cursorWorld.x - deps.conn.body!.x, y: cursorWorld.y - deps.conn.body!.y },
  };
}

function pointerViewTile(camera: WorldPointCamera, pointer: Phaser.Input.Pointer, tilePx: number): { x: number; y: number } {
  const viewPixels = camera.getWorldPoint(pointer.x, pointer.y);
  return { x: viewPixels.x / tilePx, y: viewPixels.y / tilePx };
}

interface UiHitRequest {
  state: InputState; deps: PointerDeps; uiHit: string; pointerId: number;
  pointer: Phaser.Input.Pointer;
}

function handleUiHit({ state, deps, uiHit, pointerId, pointer }: UiHitRequest): void {
  if (uiHit.startsWith("slot:")) return activateHotbar(state, deps.conn, Number(uiHit.slice(5)));
  const action = uiHitActions({ state, deps, pointerId, pointer });
  action?.[uiHit]?.();
}

interface UiHitActionsRequest {
  state: InputState; deps: PointerDeps; pointerId: number;
  pointer: Phaser.Input.Pointer;
}

function uiHitActions({ state, deps, pointerId, pointer }: UiHitActionsRequest): Record<string, () => void> {
  const { conn, queries, hooks, touch } = deps;
  return {
    "touch:attack": () => attackWithTouchAssistance({
      state,
      conn,
      queries,
      hooks,
      touch,
      cooldownMs: queries.attackCooldownMs(conn.weapon),
    }),
    "touch:block": () => pressAndMove(deps, "block", pointerId),
    "touch:jump": () => pressAndMove(deps, "jump", pointerId),
    "touch:interact": () => pressAndInteract(deps, pointerId),
    "touch:throw": () => deps.beginThrowAim(pointer),
    "chat:toggle": hooks.onToggleChat,
    "inventory:toggle": hooks.onToggleInventory,
  };
}

interface TouchAttackRequest {
  state: InputState; conn: InputConnection; queries: InputQueries; hooks: InputHooks;
  touch: TouchInputState;
  cooldownMs: number;
}

function attackWithTouchAssistance(request: TouchAttackRequest): void {
  const { state, conn, queries, hooks, touch, cooldownMs } = request;
  const fallbackDirection = screenDirToWorld(
    touch.lastFacing,
    getViewOrientation(),
  );
  triggerAssistedAttack({
    state,
    conn,
    queries,
    hooks,
    fallbackDirection,
    nowMs: performance.now(),
    cooldownMs,
  });
}

function pressAndMove(deps: PointerDeps, button: "block" | "jump", pointerId: number): void {
  pressButton(deps.touch, button, pointerId);
  deps.sendMovementEdge();
}

function pressAndInteract(deps: PointerDeps, pointerId: number): void {
  pressButton(deps.touch, "interact", pointerId);
  deps.performInteract();
}
