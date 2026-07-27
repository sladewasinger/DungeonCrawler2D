import type { PlayerVisual } from "./state.js";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { wedgeGeometry } from "../../vfx/meleeWedgeGeometry.js";
import { depthForScreenY } from "./worldToScreen.js";

export const updateGuardCone = (
  visual: PlayerVisual,
  blocking: boolean,
  facingAngle: number,
): void => {
  const cone = visual.guardCone;
  if (!cone) return;
  if (!blocking) {
    cone.setVisible(false);
    return;
  }
  const geometry = wedgeGeometry(facingAngle, SCREEN_TILE_PX);
  cone.clear();
  cone.fillStyle(0x8fd7ff, 0.11);
  cone.slice(
    visual.body.x,
    visual.body.y,
    geometry.radiusPx,
    geometry.startAngle,
    geometry.endAngle,
    false,
  );
  cone.fillPath();
  cone.setDepth(depthForScreenY(visual.body.y + geometry.radiusPx) - 0.15).setVisible(true);
};
