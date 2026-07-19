/**
 * Input facade: wires keyboard/mouse/touch Phaser events to intents sent through
 * the network connection. Nothing here mutates game state directly — every
 * handler either sends an intent or flips local UI state; the server decides
 * what happens. Touch is a virtual input source merged into the same MoveInput
 * shape keyboard produces (input/touch/*) — prediction never sees a forked
 * intent type. Split along key-chord / hotbar / pointer / touch seams to stay
 * under the file-size cap.
 */
import type Phaser from "phaser";
import type { MoveInput } from "@dc2d/engine";
import { createKeys, readMoveInput } from "./keys.js";
import { activeThrowableSlot, onNumberKey, throwPreview as resolveThrowPreview } from "./hotbar.js";
import { handlePointerDown, handlePointerMove, handlePointerUp } from "./pointer.js";
import type { InputConnection, InputHooks, InputHud, InputPanels, InputQueries, InputState, ThrowPreview } from "./state.js";
import { createTouchInputState, mergeMoveInputs, touchMoveInput, touchVisualSnapshot, updateLastFacing } from "./touch/index.js";
import type { TouchInputState, TouchVisualSnapshot } from "./touch/index.js";
import { isTouchDevice } from "./touchDetect.js";

export type {
  InputConnection,
  InputHooks,
  InputHud,
  InputPanels,
  InputQueries,
  ThrowPreview,
} from "./state.js";
export type { TouchVisualSnapshot } from "./touch/index.js";

/** Guards a key handler so typing in a chat/search box never fires game actions. */
function guarded(fn: () => void): () => void {
  return () => {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
    fn();
  };
}

export class InputController {
  private readonly state: InputState;
  private readonly touch: TouchInputState = createTouchInputState();
  private readonly touchActive: boolean = isTouchDevice();
  private readonly scene: Phaser.Scene;
  private readonly queries: InputQueries;
  private readonly tilePx: number;

  constructor(
    scene: Phaser.Scene,
    private readonly conn: InputConnection,
    private readonly panels: InputPanels,
    hud: InputHud,
    queries: InputQueries,
    hooks: InputHooks,
    /** World px per tile — passed in so input never depends on the render module. */
    tilePx: number,
  ) {
    this.scene = scene;
    this.queries = queries;
    this.tilePx = tilePx;
    const { keys, cursors } = createKeys(scene);
    this.state = { keys, cursors, nextSwingAt: 0, selectedThrowable: null };
    this.bindKeys(keys, queries, hooks);
    this.bindPointer(hud, queries, hooks, tilePx);
  }

  private bindKeys(keys: InputState["keys"], queries: InputQueries, hooks: InputHooks): void {
    const { conn, panels, state } = this;
    keys.G.on("down", guarded(() => hooks.onToggleBorders()));
    keys.E.on(
      "down",
      guarded(() => {
        panels.openStashIfNearby(conn);
        conn.interact();
      }),
    );
    keys.R.on("down", guarded(() => conn.pickup()));
    keys.C.on("down", guarded(() => panels.toggleCraft(conn)));
    keys.F.on(
      "down",
      guarded(() => {
        if (conn.pendingInvite) {
          conn.partyOp("accept");
          return;
        }
        const nearest = queries.nearestPlayerId(conn, 6);
        if (nearest) conn.partyOp("invite", nearest);
      }),
    );
    keys.ESC.on("down", () => {
      state.selectedThrowable = null;
      panels.closeAll(conn);
    });
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) throw new Error("scene has no keyboard plugin");
    for (let i = 1; i <= 9; i++) {
      keyboard.addKey(48 + i).on(
        "down",
        guarded(() => onNumberKey(state, conn, panels, queries, keys, i)),
      );
    }
  }

  private bindPointer(hud: InputHud, queries: InputQueries, hooks: InputHooks, tilePx: number): void {
    this.scene.input.mouse?.disableContextMenu();
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const viewport = { width: this.scene.scale.width, height: this.scene.scale.height };
      handlePointerDown(
        this.state,
        { conn: this.conn, hud, queries, hooks, tilePx, touch: this.touch, touchActive: this.touchActive, viewport },
        pointer,
      );
    });
    if (!this.touchActive) return;
    this.scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => handlePointerMove(this.touch, pointer));
    this.scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => handlePointerUp(this.touch, pointer));
    this.scene.input.on("pointerupoutside", (pointer: Phaser.Input.Pointer) => handlePointerUp(this.touch, pointer));
  }

  /** Sampled at the fixed tick rate by the scene. */
  readInput(): MoveInput {
    const keyboardMove = readMoveInput(this.state, this.conn);
    if (!this.touchActive) return keyboardMove;
    const merged = mergeMoveInputs(keyboardMove, touchMoveInput(this.touch));
    updateLastFacing(this.touch, merged.moveX, merged.moveY);
    return merged;
  }

  /** Current armed-throw trajectory preview, for the scene to render, or null. */
  throwPreview(): ThrowPreview | null {
    const pointer = this.scene.input.activePointer;
    return resolveThrowPreview(this.state, this.conn, this.queries, {
      x: pointer.worldX / this.tilePx,
      y: pointer.worldY / this.tilePx,
    });
  }

  /** The hotbar slot currently armed for a world-target throw, or null — HUD pulse hook. */
  armedThrowableSlot(): number | null {
    return activeThrowableSlot(this.state, this.conn, this.queries);
  }

  /** Live joystick/button state for the touch HUD widgets to render, or null when touch isn't active. */
  touchVisual(): TouchVisualSnapshot | null {
    return this.touchActive ? touchVisualSnapshot(this.touch) : null;
  }
}
