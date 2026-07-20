import type { VisualEvent } from "./connectionTypes.js";

/**
 * Derives a "floorEntered" visual event from consecutive self floor values — mirrors
 * xpEvents.ts's diff-the-cumulative-total pattern. Fires on any change (descend or
 * ascend both re-announce), never on the very first snapshot (apply.ts gates that,
 * same as xpGainEvents — a returning player's starting floor must not banner).
 */
export function floorChangeEvents(prevFloor: number, nextFloor: number): VisualEvent[] {
  return prevFloor !== nextFloor ? [{ t: "floorEntered", floor: nextFloor }] : [];
}
