/** Cancels hold gestures when a focused modal takes ownership of gameplay input. */
import type { HoldState } from "./fistbump.js";
import { holdUp } from "./fistbump.js";
import type { GiveUpGesture } from "./giveUp.js";
import type { ReviveGesture } from "./revive.js";
import type { RespawnGesture } from "./respawn.js";

export const cancelHeldGestures = (
  nowMs: number,
  revive: ReviveGesture,
  giveUp: GiveUpGesture,
  respawn: RespawnGesture,
  fistbump: HoldState,
): void => {
  revive.end(nowMs);
  giveUp.end(nowMs);
  respawn.end(nowMs);
  holdUp(fistbump, nowMs);
};
