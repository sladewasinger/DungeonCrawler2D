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

  throwFromTouch(): void {
    this.dispatch(true);
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
    return { scene, conn, queries, state, touch, touchActive, tilePx };
  }
}
