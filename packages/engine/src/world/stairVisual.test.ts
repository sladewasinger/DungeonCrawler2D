// Headless tests for stairVisualAt — the renderer's per-tile "where on the
// staircase am I" read, covering both physical Stairs tiles and the
// flanking RUN_PADDING Floor tiles.
import { describe, expect, it } from "vitest";
import { stairVisualAt, type StairView } from "./stairs.js";
import { TILE } from "./types.js";

const X = 100;
const Y = 100;

/** A single north-climbing Stairs tile at (X, Y): flat 0 south, flat 1 north. */
function southEntryWorld(): StairView {
  return {
    tileAt: (wx, wy) => (wx === X && wy === Y ? TILE.Stairs : TILE.Floor),
    heightAt: (wx, wy) => {
      if (wx !== X) return wy < Y ? 1 : 0;
      if (wy === Y) return 0.5;
      return wy < Y ? 1 : 0;
    },
  };
}

/** An east-climbing 2-row-wide run at column X, rows Y..Y+1 — the shape of the
 * real-world (-43, 6..7) staircase this lane's brief anchors on. */
function eastEntryWorld(): StairView {
  const stairRows = new Set([Y, Y + 1]);
  return {
    tileAt: (wx, wy) => (wx === X && stairRows.has(wy) ? TILE.Stairs : TILE.Floor),
    heightAt: (wx, wy) => {
      if (!stairRows.has(wy)) return wx < X ? 0 : 1;
      if (wx === X) return 0.5;
      return wx < X ? 0 : 1;
    },
  };
}

// Re-baselined for RUN_PADDING retired to 0 (docs/R2-STAIRS-SPEC.md, Wave
// R2): the visual now confines to exactly the run's own physical tile(s) —
// no more fading "padding" reach into the flanking Floor tiles.
describe("stairVisualAt", () => {
  it("reports the climb direction, t=0.5 at the tile's own center (a lone tile's own physical extent)", () => {
    const world = southEntryWorld();
    const visual = stairVisualAt(world, X, Y);
    expect(visual).not.toBeNull();
    expect(visual?.direction).toBe(0); // climbs north
    expect(visual?.t).toBeCloseTo(0.5, 5);
  });

  it("returns null on the Floor tile south of the run (no more padding reach)", () => {
    const world = southEntryWorld();
    expect(stairVisualAt(world, X, Y + 1)).toBeNull();
  });

  it("returns null once a query tile sits beyond the run's own physical extent", () => {
    const world = southEntryWorld();
    expect(stairVisualAt(world, X, Y + 5)).toBeNull();
  });

  it("returns null off-axis (a flanking column with no run of its own)", () => {
    const world = southEntryWorld();
    expect(stairVisualAt(world, X + 5, Y)).toBeNull();
  });

  it("reports an east climb direction for a 2-wide east-entry run, both rows agreeing", () => {
    const world = eastEntryWorld();
    const row0 = stairVisualAt(world, X, Y);
    const row1 = stairVisualAt(world, X, Y + 1);
    expect(row0?.direction).toBe(1); // climbs east
    expect(row1?.direction).toBe(1);
    expect(row0?.t).toBeCloseTo(row1?.t ?? -1, 5);
  });

  it("returns null west of an east-entry run (no more fading padding reach)", () => {
    const world = eastEntryWorld();
    expect(stairVisualAt(world, X - 1, Y)).toBeNull();
    expect(stairVisualAt(world, X - 2, Y)).toBeNull();
  });
});
