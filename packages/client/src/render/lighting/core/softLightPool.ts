import type { ViewRect } from "../../terrain/streaming/streaming.js";
import { lightOverlayDepth } from "./lightDepth.js";
import { LightSpritePool } from "./pool.js";

export function clearSoftLightPool(
  pool: LightSpritePool,
  nowMs: number,
  view: ViewRect,
): void {
  pool.sync({ lights: [], nowMs, overlayDepth: lightOverlayDepth(view) });
}
