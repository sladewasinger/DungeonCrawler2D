import type Phaser from "phaser";
import { bindKeyboardMovementEdges } from "../movementEdges.js";
import { bindInputPointerEdges } from "../pointer/pointerBindings.js";
import { inputModality, type InputModality } from "../controls/inputModality.js";
import type { InputConnection, InputHooks, InputHud, InputPanels, InputQueries, InputState } from "../controls/state.js";
import type { TouchInputState } from "../touch/index.js";
import { bindControllerKeys } from "./keyboard.js";

export interface ControllerEventBindings {
  readonly scene: Phaser.Scene;
  readonly conn: InputConnection;
  readonly panels: InputPanels;
  readonly hud: InputHud;
  readonly queries: InputQueries;
  readonly hooks: InputHooks;
  readonly state: InputState;
  readonly touch: TouchInputState;
  readonly tilePx: number;
  readonly touchActive: () => boolean;
  readonly onThrowAimStart: () => void;
  readonly onThrowAimRelease: (allowThrow: boolean) => void;
  readonly onKeyboardInteract: () => void;
  readonly onTouchInteract: () => void;
  readonly onInteractReleased: () => void;
  readonly onBandageDown: () => void;
  readonly onBandageUp: () => void;
  readonly onThrowAimMove: (pointer: Phaser.Input.Pointer) => void;
  readonly onTouchThrowStart: (pointer: Phaser.Input.Pointer) => void;
  readonly onTouchThrowRelease: (pointerId: number, allowThrow: boolean) => void;
  readonly onKidAttack: () => void;
  readonly onMovementEdge: () => void;
  readonly onModality: (mode: InputModality) => void;
}

export function bindControllerEvents(request: ControllerEventBindings): () => void {
  bindKeys(request);
  bindKeyboardMovementEdges(request.state, request.onMovementEdge);
  bindPointer(request);
  return inputModality.subscribe(request.onModality);
}

function bindKeys(request: ControllerEventBindings): void {
  bindControllerKeys({
    keys: request.state.keys,
    keyboard: request.scene.input.keyboard,
    conn: request.conn,
    panels: request.panels,
    state: request.state,
    queries: request.queries,
    hooks: request.hooks,
    onThrowAimStart: request.onThrowAimStart,
    onThrowAimRelease: request.onThrowAimRelease,
    onInteract: request.onKeyboardInteract,
    onInteractReleased: request.onInteractReleased,
    onBandageDown: request.onBandageDown,
    onBandageUp: request.onBandageUp,
    onKidAttack: request.onKidAttack,
  });
}

function bindPointer(request: ControllerEventBindings): void {
  bindInputPointerEdges({
    scene: request.scene,
    state: request.state,
    conn: request.conn,
    hud: request.hud,
    queries: request.queries,
    hooks: request.hooks,
    tilePx: request.tilePx,
    touch: request.touch,
    touchActive: request.touchActive,
    onInteract: request.onTouchInteract,
    onInteractReleased: request.onInteractReleased,
    onThrowAimStart: request.onTouchThrowStart,
    onThrowAimMove: request.onThrowAimMove,
    onThrowAimRelease: request.onTouchThrowRelease,
    onMovementEdge: request.onMovementEdge,
  });
}
