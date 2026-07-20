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

describe("stairVisualAt", () => {
  it("reports the climb direction, with t near the top of its 1-tile-plus-padding range on the tread itself", () => {
    const world = southEntryWorld();
    const visual = stairVisualAt(world, X, Y);
    expect(visual).not.toBeNull();
    expect(visual?.direction).toBe(0); // climbs north
    // Tile CENTER sits half a tile south of the run's true top edge (where t
    // hits exactly 1), so a single-tile run's own tread reads under 1 — this
    // is the same t stairRampAt would compute at that same position.
    expect(visual?.t).toBeCloseTo(0.8, 5);
  });

  it("returns a lower, non-null t on the padding Floor tile south of a run", () => {
    const world = southEntryWorld();
    const onRun = stairVisualAt(world, X, Y);
    const padding = stairVisualAt(world, X, Y + 1);
    expect(padding).not.toBeNull();
    expect(padding?.direction).toBe(0);
    expect(padding?.t).toBeGreaterThan(0);
    expect(padding?.t).toBeLessThan(onRun?.t ?? 0);
  });

  it("returns null once a query tile sits beyond both the search radius and the padding reach", () => {
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

  it("padding west of an east-entry run ramps toward 0 the further it sits from the tread", () => {
    const world = eastEntryWorld();
    const near = stairVisualAt(world, X - 1, Y);
    const far = stairVisualAt(world, X - 2, Y);
    expect(near?.t ?? 0).toBeGreaterThan(far?.t ?? 0);
  });
});
