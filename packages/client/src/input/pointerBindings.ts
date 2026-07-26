import type Phaser from "phaser";
import { inputModality } from "./inputModality.js";
import { handlePointerDown } from "./pointer.js";
import { bindPointerMovementEdges } from "./pointerMovementEdges.js";
import type {
  InputConnection,
  InputHooks,
  InputHud,
  InputQueries,
  InputState,
} from "./state.js";
import type { TouchInputState } from "./touch/index.js";

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
  onContextAction(): void;
  onThrowSelected(): void;
  onMovementEdge(): void;
}

export function bindInputPointerEdges(options: PointerBindingOptions): void {
  const {
    scene, state, conn, hud, queries, hooks, tilePx, touch, touchActive,
    onInteractReleased, onContextAction, onThrowSelected, onMovementEdge,
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
      performContextAction: onContextAction,
      throwSelected: onThrowSelected,
      viewport: { width: scene.scale.width, height: scene.scale.height },
      camera: scene.cameras.main,
    }, pointer);
  });
  bindPointerMovementEdges(
    scene,
    touch,
    touchActive,
    onInteractReleased,
    onMovementEdge,
  );
}
