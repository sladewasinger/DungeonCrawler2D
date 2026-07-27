import type Phaser from "phaser";
import type { PlayerVisual } from "./state.js";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { wedgeGeometry } from "../../vfx/meleeWedgeGeometry.js";
import { depthForAdjacentTerrainOverlay } from "./depthSort.js";
import { combatOriginY } from "./weaponOrbit.js";
import type { CombatOverlayPosition } from "./worldToScreen.js";

export interface GuardConeDepth extends CombatOverlayPosition {
  readonly wielderDepth: number;
}

const GUARD_FILL_COLOR = 0x28658d;
const GUARD_FILL_ALPHA = 0.34;
const GUARD_RIM_COLOR = 0xb7e8ff;
const GUARD_RIM_ALPHA = 0.9;
const GUARD_RIM_WIDTH_PX = 2;

export const updateGuardCone = (
  visual: PlayerVisual,
  blocking: boolean,
  facingAngle: number,
  depth: GuardConeDepth,
): void => {
  const cone = visual.guardCone;
  if (!cone) return;
  if (!blocking) {
    cone.setVisible(false);
    return;
  }
  const geometry = wedgeGeometry(facingAngle, SCREEN_TILE_PX);
  const originY = combatOriginY(visual.body.y, SCREEN_TILE_PX);
  drawGuardCone(cone, visual.body.x, originY, geometry);
  const overlayDepth = depthForAdjacentTerrainOverlay(
    depth.wielderViewY,
    depth.wielderDepth,
    depth.screenSouthFloorHigher,
  );
  cone.setDepth(overlayDepth - 0.02).setVisible(true);
};

function drawGuardCone(
  cone: Phaser.GameObjects.Graphics,
  originX: number,
  originY: number,
  geometry: ReturnType<typeof wedgeGeometry>,
): void {
  cone.clear();
  cone.fillStyle(GUARD_FILL_COLOR, GUARD_FILL_ALPHA);
  cone.slice(originX, originY, geometry.radiusPx, geometry.startAngle, geometry.endAngle, false);
  cone.fillPath();
  cone.lineStyle(GUARD_RIM_WIDTH_PX, GUARD_RIM_COLOR, GUARD_RIM_ALPHA);
  cone.slice(originX, originY, geometry.radiusPx, geometry.startAngle, geometry.endAngle, false);
  cone.strokePath();
}
