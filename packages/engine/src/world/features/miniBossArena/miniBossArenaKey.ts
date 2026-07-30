/** Stable identity shared by simulation, replication, and deterministic arena generation. */
export interface MiniBossArenaKeyInput {
  readonly floor: number;
  readonly cx: number;
  readonly cy: number;
}

export function miniBossArenaKey(input: MiniBossArenaKeyInput): string {
  return `${input.floor}:${input.cx},${input.cy}`;
}
