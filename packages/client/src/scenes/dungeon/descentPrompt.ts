/**
 * One-way stairway prompt label. The HUD widget prepends the key itself.
 */
export type StairwayDirection = "down";

/** `floor` is the next deeper destination. */
export function descentPromptLabel(_direction: StairwayDirection, floor: number): string {
  return `Descend to Floor ${floor}`;
}
