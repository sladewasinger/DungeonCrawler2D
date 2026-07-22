/** Smooths the predicted shared-engine body for first-person camera presentation. */
import type { FirstPersonState } from "./movement.js";

const RESPONSE = 22;

export const presentFirstPerson = (
  current: FirstPersonState,
  target: FirstPersonState,
  elapsed: number,
): FirstPersonState => {
  const blend = 1 - Math.exp(-RESPONSE * Math.max(0, elapsed));
  return {
    x: current.x + (target.x - current.x) * blend,
    y: current.y + (target.y - current.y) * blend,
    z: current.z + (target.z - current.z) * blend,
    verticalVelocity: target.verticalVelocity,
    grounded: target.grounded,
  };
};
