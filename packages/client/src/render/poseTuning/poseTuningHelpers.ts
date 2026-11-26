/** Pure pose-tuning lookup helpers used by held gear layout. */
import { getPoseTuning } from "./poseTuningStore.js";
import type { LeftCarryDirTune, RightCarryDirTune } from "./poseTuningTypes.js";

const DEFAULT_SWORD: RightCarryDirTune = {
  x: -4.1, y: -8.3, rot: 0.92, behind: false, rotSign: -1, scaleSign: -1,
  armBehind: false, armShaded: false, armTaper: false, maxBendRad: 0.22,
};

const DEFAULT_LANTERN: LeftCarryDirTune = {
  x: 4.1, y: -8.3, rot: 0, behind: false, armBehind: false, armShaded: false, armTaper: false, maxBendRad: 0.22,
};

export function getTunedSwordArm(yawIdx: number, body?: string): RightCarryDirTune {
  const arr = getPoseTuning(body).sword;
  return arr[yawIdx] ?? arr[0] ?? DEFAULT_SWORD;
}

export function getTunedLanternArm(yawIdx: number, body?: string): LeftCarryDirTune {
  const arr = getPoseTuning(body).lantern;
  return arr[yawIdx] ?? arr[0] ?? DEFAULT_LANTERN;
}
