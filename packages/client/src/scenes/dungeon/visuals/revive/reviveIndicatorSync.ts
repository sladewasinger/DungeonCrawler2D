/** Resolves the local revive hold to the one scene-owned large yellow indicator. */
import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import type { InputController } from "../../../../input/index.js";
import type { Connection } from "../../../../net/connection/connection.js";
import { worldToScreen } from "../../../../render/entities/geometry/worldToScreen.js";
import type { FistbumpRing } from "../fistbumpRing.js";

const INDICATOR_HEAD_OFFSET_TILES = 1.3;

export function syncReviveIndicator(
  indicator: FistbumpRing,
  inputController: InputController,
  connection: Connection,
): void {
  const hold = inputController.reviveHoldView();
  const target = hold ? connection.entities.get(hold.targetId)?.snap : undefined;
  indicator.update(reviveIndicatorState(hold, target));
}

interface ReviveHoldView {
  readonly targetId: string;
  readonly progress: number;
}

interface ReviveTargetView {
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly downed?: boolean | undefined;
}

export interface ReviveIndicatorState {
  readonly x: number;
  readonly y: number;
  readonly progress: number;
}

export function reviveIndicatorState(
  hold: ReviveHoldView | null,
  target: ReviveTargetView | undefined,
): ReviveIndicatorState | null {
  if (!hold || target?.kind !== "player" || !target.downed) return null;
  const screen = worldToScreen(target.x, target.y);
  return {
    x: screen.x,
    y: screen.y - INDICATOR_HEAD_OFFSET_TILES * SCREEN_TILE_PX,
    progress: hold.progress,
  };
}
