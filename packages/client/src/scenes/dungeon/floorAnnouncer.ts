/**
 * Floor-entry announcer lines (Epic 7.14's "DCC personality layer"), escalating menace
 * per floor. This table mirrors game-server/src/sim/announcer/lines.ts's
 * `FLOOR_ENTRY_LINES` verbatim — the server already broadcasts these over the existing
 * "system" chat channel (docs/ASSUMPTIONS.md #124), but the client package can't import
 * game-server's content across the package boundary, so the floor banner's big-text
 * treatment keeps its own copy. Keep in sync manually if the server lane edits its lines.
 */
const FLOOR_LINES: readonly string[] = [
  "Floor 1. Try not to die.",
  "Floor 2. The slimes here have opinions.",
  "Floor 3. It gets warmer wherever the blood pools.",
  "Floor 4. Whatever's down here has had time to think about you.",
  "Floor 5. The Warden is expecting you.",
];

/** Floors past the authored table repeat the last (deepest) line — never blank. */
export function floorAnnouncerLine(floor: number): string {
  const index = Math.min(Math.max(floor, 1), FLOOR_LINES.length) - 1;
  return FLOOR_LINES[index] ?? FLOOR_LINES[0] ?? "";
}
