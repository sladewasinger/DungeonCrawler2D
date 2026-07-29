/** Cancels hold gestures when a focused modal takes ownership of gameplay input. */
import type { HoldState } from "./fistbump.js";
import { holdUp } from "./fistbump.js";
import type { GiveUpGesture } from "./giveUp.js";
import type { ReviveGesture } from "./revive.js";

export interface HeldGestures {
  revive: ReviveGesture;
  giveUp: GiveUpGesture;
  fistbump: HoldState;
}

export const cancelHeldGestures = (nowMs: number, { revive, giveUp, fistbump }: HeldGestures): void => {
  revive.end(nowMs);
  giveUp.end(nowMs);
  holdUp(fistbump, nowMs);
};
