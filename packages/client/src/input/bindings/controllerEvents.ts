import type Phaser from "phaser";
import { bindKeyboardMovementEdges } from "../movementEdges.js";
import { bindInputPointerEdges } from "../pointerBindings.js";
import { inputModality, type InputModality } from "../inputModality.js";
import type { InputConnection, InputHooks, InputHud, InputPanels, InputQueries, InputState } from "../state.js";
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
  readonly onGod: () => void;
  readonly onInteract: () => void;
  readonly onInteractReleased: () => void;
  readonly onBandageDown: () => void;
  readonly onBandageUp: () => void;
  readonly onContextAction: () => void;
  readonly onThrowSelected: () => void;
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
    onGod: request.onGod,
    onInteract: request.onInteract,
    onInteractReleased: request.onInteractReleased,
    onBandageDown: request.onBandageDown,
    onBandageUp: request.onBandageUp,
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
    onInteractReleased: request.onInteractReleased,
    onContextAction: request.onContextAction,
    onThrowSelected: request.onThrowSelected,
    onMovementEdge: request.onMovementEdge,
  });
}
