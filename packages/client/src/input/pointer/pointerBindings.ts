import type Phaser from "phaser";
import { inputModality } from "../controls/inputModality.js";
import { handlePointerDown } from "./pointer.js";
import { bindPointerMovementEdges } from "./pointerMovementEdges.js";
import type {
  InputConnection,
  InputHooks,
  InputHud,
  InputQueries,
  InputState,
} from "../controls/state.js";
import type { TouchInputState } from "../touch/index.js";

interface PointerBindingOptions {
  scene: Phaser.Scene;
  state: InputState;
  conn: InputConnection;
  hud: InputHud;
  queries: InputQueries;
  hooks: InputHooks;
  tilePx: number;
  touch: TouchInputState;
  touchActive(): boolean;
  onInteractReleased(): void;
  onInteract(): void;
  onThrowSelected(): void;
  onMovementEdge(): void;
}

export function bindInputPointerEdges(options: PointerBindingOptions): void {
  const {
    scene, state, conn, hud, queries, hooks, tilePx, touch, touchActive,
    onInteract, onInteractReleased, onThrowSelected, onMovementEdge,
  } = options;
  scene.input.mouse?.disableContextMenu();
  scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (pointer.wasTouch) inputModality.noteTouch(scene.time.now);
    handlePointerDown(state, {
      conn,
      hud,
      queries,
      hooks,
      tilePx,
      touch,
      touchActive: touchActive(),
      sendMovementEdge: onMovementEdge,
      performInteract: onInteract,
      throwSelected: onThrowSelected,
      viewport: { width: scene.scale.width, height: scene.scale.height },
      camera: scene.cameras.main,
    }, pointer);
  });
  bindPointerMovementEdges({ scene, touch, touchActive, onInteractReleased, onMovementEdge });
}
