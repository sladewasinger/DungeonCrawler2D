import type Phaser from "phaser";
import {
  resolveCurrentThrowTarget,
  type CurrentThrowTargetRequest,
} from "../actions/throwTarget.js";
import { throwSelected } from "../gameplay/gameplayActions.js";
import { activeThrowableSlot } from "../gameplay/hotbar.js";
import type {
  InputConnection,
  InputQueries,
  InputState,
  ThrowPreview,
} from "../controls/state.js";
import type { TouchInputState } from "../touch/index.js";
import { KeyboardThrowAim } from "./keyboardThrowAim.js";

export interface ThrowAimControllerOptions {
  readonly scene: Phaser.Scene;
  readonly conn: InputConnection;
  readonly queries: InputQueries;
  readonly state: InputState;
  readonly touch: TouchInputState;
  readonly touchActive: () => boolean;
  readonly tilePx: number;
}

/** Coordinates keyboard aim lifecycle, touch's immediate throw, and HUD preview. */
export class ThrowAimController {
  private readonly gesture = new KeyboardThrowAim();
  private touchPointer: { id: number; x: number; y: number } | null = null;

  constructor(private readonly options: ThrowAimControllerOptions) {}

  beginKeyboardAim(): void {
    const { state, conn, queries } = this.options;
    this.gesture.press({
      throwableSelected: activeThrowableSlot(state, conn, queries) !== null,
      allowDebug: import.meta.env.DEV && state.selectedSlot === null,
      onDebug: () => conn.debugGod?.(),
    });
  }

  releaseKeyboardAim(allowThrow: boolean): void {
    this.gesture.release({
      allowThrow,
      onThrow: () => this.dispatch(this.options.touchActive()),
    });
  }

  beginTouchAim(pointer: { id: number; x: number; y: number }): void {
    const { state, conn, queries } = this.options;
    if (this.touchPointer || activeThrowableSlot(state, conn, queries) === null) return;
    this.touchPointer = { ...pointer };
    this.gesture.press({ throwableSelected: true, allowDebug: false, onDebug: () => undefined });
  }

  moveTouchAim(pointer: { id: number; x: number; y: number }): void {
    if (this.touchPointer?.id === pointer.id) this.touchPointer = { ...pointer };
  }

  releaseTouchAim(pointerId: number, allowThrow: boolean): void {
    if (this.touchPointer?.id !== pointerId) return;
    this.gesture.release({ allowThrow, onThrow: () => this.dispatch(true) });
    this.touchPointer = null;
  }

  cancelTouchAim(): void {
    if (!this.touchPointer) return;
    this.touchPointer = null;
    this.gesture.release({ allowThrow: false, onThrow: () => undefined });
  }

  preview(): ThrowPreview | null {
    if (!this.gesture.active()) return null;
    const target = resolveCurrentThrowTarget(
      this.currentTargetRequest(this.options.touchActive()),
    );
    return target
      ? { slot: target.slot, targetX: target.x, targetY: target.y }
      : null;
  }

  armedSlot(): number | null {
    if (!this.gesture.active()) return null;
    const { state, conn, queries } = this.options;
    return activeThrowableSlot(state, conn, queries);
  }

  private dispatch(touchActive: boolean): void {
    throwSelected(this.currentTargetRequest(touchActive));
  }

  private currentTargetRequest(
    touchActive: boolean,
  ): CurrentThrowTargetRequest {
    const { scene, conn, queries, state, touch, tilePx } = this.options;
    return { scene, conn, queries, state, touch, touchActive, tilePx, ...(this.touchPointer ? { touchPointer: this.touchPointer } : {}) };
  }
}
