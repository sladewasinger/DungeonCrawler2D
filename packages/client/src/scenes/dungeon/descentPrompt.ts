/**
 * Stairway interact-prompt label text — the *label* half only ("Descend to Floor N" /
 * "Ascend to Floor N"); interactionPrompt.ts's HUD widget prepends the "[key]" itself
 * (mirrors the existing "interact"/"pick up" labels), so this must not include it.
 */
export type StairwayDirection = "down" | "up";

/** `floor` is the destination floor: current+1 for "down", current-1 for "up". */
export function descentPromptLabel(direction: StairwayDirection, floor: number): string {
  return direction === "down" ? `Descend to Floor ${floor}` : `Ascend to Floor ${floor}`;
}
