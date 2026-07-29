import { AREA_FLOOR_FIRE_FLAMES } from "../presentation/areaVisualStyle.js";

const FULL_CIRCLE = Math.PI * 2;

export interface FloorFireFlameState {
  alpha: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  xOffset: number;
  yOffset: number;
}

export interface FloorFireFlameUpdate {
  readonly state: FloorFireFlameState;
  readonly index: number;
  readonly nowMs: number;
  readonly phaseOffset: number;
}

export function createFloorFireFlameStates(): FloorFireFlameState[] {
  return AREA_FLOOR_FIRE_FLAMES.layers.map(() => ({
    alpha: 0,
    angle: 0,
    scaleX: 0,
    scaleY: 0,
    xOffset: 0,
    yOffset: 0,
  }));
}

export function updateFloorFireFlameState(
  update: FloorFireFlameUpdate,
): void {
  const { state, index, nowMs, phaseOffset } = update;
  const layer = AREA_FLOOR_FIRE_FLAMES.layers[index];
  if (!layer) return;
  const phase = (nowMs / AREA_FLOOR_FIRE_FLAMES.periodMs) * FULL_CIRCLE +
    layer.phase + phaseOffset;
  const sway = Math.sin(phase);
  const flicker = Math.sin(phase * 1.7 + layer.phase) * 0.06;
  state.alpha = layer.alpha + flicker;
  state.angle = layer.leanDegrees + sway * 3;
  state.scaleX = layer.horizontalScale * (1 - flicker * 0.6);
  state.scaleY = layer.verticalScale * (1 + flicker);
  state.xOffset = sway * AREA_FLOOR_FIRE_FLAMES.horizontalPulsePx;
  state.yOffset = layer.verticalOffsetPx -
    Math.abs(Math.sin(phase * 1.3)) * AREA_FLOOR_FIRE_FLAMES.verticalPulsePx;
}
