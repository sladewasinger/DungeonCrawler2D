import type { VisualEvent } from "./connectionTypes.js";

/**
 * Derives a "floorEntered" visual event from consecutive self floor values — mirrors
 * xpEvents.ts's diff-the-cumulative-total pattern. Descent and death returns both
 * re-announce, but the very first snapshot stays quiet,
 * same as xpGainEvents — a returning player's starting floor must not banner).
 */
export function floorChangeEvents(prevFloor: number, nextFloor: number): VisualEvent[] {
  return prevFloor !== nextFloor ? [{ t: "floorEntered", floor: nextFloor }] : [];
}
