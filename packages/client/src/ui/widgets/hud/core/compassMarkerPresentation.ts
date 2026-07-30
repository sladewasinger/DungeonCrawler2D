import type Phaser from "phaser";
import type {
  CompassLandmarkTicks,
  StairwayTickData,
} from "./fakeData.js";
import { COMPASS_MARKER_RADIUS } from "./compassPresentation.js";

const PULSE_AMPLITUDE = 0.5;
const PULSE_RATE_MS = 110;

export function syncStairwayTick(
  point: Phaser.GameObjects.Graphics,
  stairway: StairwayTickData,
  nowMs: number,
): void {
  const rad = stairway.screenBearingDeg * Math.PI / 180;
  point.setPosition(
    Math.sin(rad) * COMPASS_MARKER_RADIUS,
    -Math.cos(rad) * COMPASS_MARKER_RADIUS,
  );
  point.setRotation(rad);
  point.setScale(stairway.near ? proximityPulse(nowMs) : 1);
}

export function syncLandmarkPoint(
  point: Phaser.GameObjects.Graphics,
  target: CompassLandmarkTicks["safeRoom"],
): void {
  point.setVisible(target !== null);
  if (!target) return;
  const rad = target.screenBearingDeg * Math.PI / 180;
  point.setPosition(
    Math.sin(rad) * COMPASS_MARKER_RADIUS,
    -Math.cos(rad) * COMPASS_MARKER_RADIUS,
  );
}

function proximityPulse(nowMs: number): number {
  return 1 + PULSE_AMPLITUDE * (0.5 + 0.5 * Math.sin(nowMs / PULSE_RATE_MS));
}
