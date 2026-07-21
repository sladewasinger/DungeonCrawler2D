// Headless tests for the dynamic-vs-static face-row split (the strip-height perf fix)
// and the ELEVATION-PROJECTION cap-container/overhang math (docs/ELEVATION-PROJECTION.md
// section 2). Fixtures below use the spec's own worked examples A-E (section 1) with
// hand-derived expected values, not the implementation echoed back at itself.
import { describe, expect, it } from "vitest";
import { depthForCapOccluder, depthForEntity } from "../entities/depthSort.js";
import {
  bakesIntoStaticBase,
  capOverhangAbove,
  capOverhangBelow,
  DYNAMIC_FACE_ROWS,
  intrudedFromScreenNorth,
  isFlatSurface,
  stripOverhangTiles,
  surfaceContainerFor,
  type SurfaceHeightRead,
} from "./occluderBand.js";
import { MAX_FACE_ROWS } from "./ownFace.js";
import { surfaceLiftPx } from "./placeSprite.js";

describe("bakesIntoStaticBase", () => {
  it("keeps every row of the dynamic band in the occluder strip", () => {
    for (let d = 1; d <= DYNAMIC_FACE_ROWS; d++) {
      expect(bakesIntoStaticBase(d), `distanceToGround ${d}`).toBe(false);
    }
  });

  it("sends every row above the band to the static base sheet", () => {
    for (let d = DYNAMIC_FACE_ROWS + 1; d <= MAX_FACE_ROWS; d++) {
      expect(bakesIntoStaticBase(d), `distanceToGround ${d}`).toBe(true);
    }
  });

  it("splits exactly at the band boundary", () => {
    expect(bakesIntoStaticBase(DYNAMIC_FACE_ROWS)).toBe(false);
    expect(bakesIntoStaticBase(DYNAMIC_FACE_ROWS + 1)).toBe(true);
  });
});

describe("DYNAMIC_FACE_ROWS", () => {
  it("is strictly smaller than MAX_FACE_ROWS — otherwise the split fixes nothing", () => {
    expect(DYNAMIC_FACE_ROWS).toBeLessThan(MAX_FACE_ROWS);
  });

  it("covers an occludable entity's full sprite reach with margin", () => {
    // depthSort.ts: a strip at base row Y occludes feet down to Y + 1 (one row
    // south of the base). Tallest sprite art is 2.25 screen tiles (36px source
    // at x3 over 48px tiles); a jump apex adds ~1.1 tiles of lift
    // (JUMP_VELOCITY^2 / (2 * GRAVITY) = 8.515^2 / 67.8). The band must cover
    // that whole reach measured from one row south of the strip's base.
    const feetRowsSouthOfBase = 1;
    const tallestSpriteTiles = 2.25;
    const jumpApexTiles = 1.1;
    expect(DYNAMIC_FACE_ROWS).toBeGreaterThanOrEqual(
      Math.ceil(feetRowsSouthOfBase + tallestSpriteTiles + jumpApexTiles),
    );
  });
});

describe("stripOverhangTiles", () => {
  it("anchors the ground-adjacent row at the strip's base (overhang 0)", () => {
    expect(stripOverhangTiles(1)).toBe(0);
  });

  it("rises one tile per row up the face", () => {
    for (let d = 1; d <= DYNAMIC_FACE_ROWS; d++) {
      expect(stripOverhangTiles(d)).toBe(d - 1);
    }
  });

  it("never exceeds the band's tallest overhang for dynamic rows", () => {
    expect(stripOverhangTiles(DYNAMIC_FACE_ROWS)).toBe(DYNAMIC_FACE_ROWS - 1);
  });
});

// --- ELEVATION-PROJECTION cap containers/overhang (spec section 1's worked examples) ---
//
// A. z1 platform, 2 rows deep (vy=10,11 h1): both caps shift ONE row up (10->9, 11->10).
// B. z1 platform 1x1 (h1): cap shifts one row up; height gets its own screen row.
// C. 2-tall wall (h2): caps shift TWO rows up (screen 8,9 from raw 10,11).
// D. z-1 pit floor (h=-1): shifts one row DOWN (screen 12,13 from raw 11,12).
// E. rim-straddle stair, ramp center h=-0.5: shifts HALF a row down (screen 11.5 from raw 11).
describe("surfaceLiftPx (spec worked examples)", () => {
  it("A/B: h=1 shifts exactly one tile screen-up", () => {
    expect(surfaceLiftPx(1)).toBe(48);
  });

  it("C: h=2 shifts exactly two tiles screen-up", () => {
    expect(surfaceLiftPx(2)).toBe(96);
  });

  it("D: h=-1 (a pit floor) shifts exactly one tile screen-DOWN", () => {
    expect(surfaceLiftPx(-1)).toBe(-48);
  });

  it("E: the ramp-center height -0.5 shifts half a tile screen-down", () => {
    expect(surfaceLiftPx(-0.5)).toBe(-24);
  });

  it("flat ground (h=0) never shifts", () => {
    expect(surfaceLiftPx(0)).toBe(0);
  });
});

describe("capOverhangAbove / capOverhangBelow", () => {
  it("A/B: h=1 needs exactly 1 tile of overhang above, none below", () => {
    expect(capOverhangAbove(1)).toBe(1);
    expect(capOverhangBelow(1)).toBe(0);
  });

  it("C: h=2 needs exactly 2 tiles of overhang above, none below", () => {
    expect(capOverhangAbove(2)).toBe(2);
    expect(capOverhangBelow(2)).toBe(0);
  });

  it("D: h=-1 needs exactly 1 tile of overhang below, none above", () => {
    expect(capOverhangAbove(-1)).toBe(0);
    expect(capOverhangBelow(-1)).toBe(1);
  });

  it("E: the ramp-center height -0.5 rounds up to 1 tile of overhang below", () => {
    expect(capOverhangAbove(-0.5)).toBe(0);
    expect(capOverhangBelow(-0.5)).toBe(1);
  });

  it("flat ground (h=0) needs no overhang either way", () => {
    expect(capOverhangAbove(0)).toBe(0);
    expect(capOverhangBelow(0)).toBe(0);
  });
});

describe("isFlatSurface", () => {
  it("is true only at (near enough) zero height", () => {
    expect(isFlatSurface(0)).toBe(true);
    expect(isFlatSurface(1)).toBe(false);
    expect(isFlatSurface(-1)).toBe(false);
    expect(isFlatSurface(-0.5)).toBe(false);
  });
});

/** Height fixture keyed "x,y"; missing cells are flat 0 ground (groundAt === heightAt).
 * `wallCells` get a non-finite groundAt, mirroring the real world's wall behavior. */
function heightRead(heights: Record<string, number>, wallCells: ReadonlySet<string> = new Set()): SurfaceHeightRead {
  const heightAt = (x: number, y: number): number => heights[`${x},${y}`] ?? 0;
  return {
    heightAt,
    groundAt: (x, y) => {
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      return wallCells.has(`${tx},${ty}`) ? Infinity : heightAt(tx, ty);
    },
  };
}

describe("intrudedFromScreenNorth", () => {
  // Each expectation hand-derived from the rule "cell k rows north intrudes
  // once its drawn surface height h < 1 - k" (its down-shifted cap band starts
  // at (vy - k) - h, reaching row vy exactly when that inequality holds).
  it("is false over flat ground everywhere", () => {
    expect(intrudedFromScreenNorth(heightRead({}), 5, 5)).toBe(false);
  });

  it("a z-1 pit floor directly north intrudes (h=-1 < 1-1) — the pit's south rim", () => {
    expect(intrudedFromScreenNorth(heightRead({ "5,4": -1 }), 5, 5)).toBe(true);
  });

  it("a 1-deep pit two rows north does NOT reach this far (-1 < 1-2 is false)", () => {
    expect(intrudedFromScreenNorth(heightRead({ "5,3": -1 }), 5, 5)).toBe(false);
  });

  it("a 2-deep pit two rows north DOES reach (-2 < -1)", () => {
    expect(intrudedFromScreenNorth(heightRead({ "5,3": -2 }), 5, 5)).toBe(true);
  });

  it("a rim-straddle stair north intrudes via its ramp-center ground (-0.5 < 0), even at heightAt 0", () => {
    const world: SurfaceHeightRead = {
      heightAt: () => 0,
      groundAt: (x, y) => (Math.floor(x) === 5 && Math.floor(y) === 4 ? -0.5 : 0),
    };
    expect(intrudedFromScreenNorth(world, 5, 5)).toBe(true);
  });

  it("RAISED content north never intrudes — it shifts up, away from this row", () => {
    expect(intrudedFromScreenNorth(heightRead({ "5,4": 2, "5,3": 3 }), 5, 5)).toBe(false);
  });

  it("a wall north (non-finite groundAt) falls back to heightAt and does not intrude", () => {
    expect(intrudedFromScreenNorth(heightRead({ "5,4": 1 }, new Set(["5,4"])), 5, 5)).toBe(false);
  });
});

describe("surfaceContainerFor", () => {
  // Fakes stand in for Phaser.GameObjects.Container — surfaceContainerFor only
  // ever compares references and forwards args, never touches container internals.
  const below = { list: [] } as unknown as Parameters<typeof surfaceContainerFor>[4];
  const capContainer = { list: [] } as unknown as ReturnType<Parameters<typeof surfaceContainerFor>[5]>;
  const flatWorld = heightRead({});

  it("routes flat (h=0) surfaces with a flat neighborhood straight to the base sheet", () => {
    const capOccluderFor = () => {
      throw new Error("must not be called for a flat surface");
    };
    expect(surfaceContainerFor(flatWorld, 5, 11, 0, below, capOccluderFor)).toBe(below);
  });

  it("A/B: routes a raised platform (h=1) through capOccluderFor with 1 tile of overhang above", () => {
    const calls: Array<[number, number | undefined, number | undefined]> = [];
    const capOccluderFor = (vy: number, above?: number, belowOverhang?: number) => {
      calls.push([vy, above, belowOverhang]);
      return capContainer;
    };
    expect(surfaceContainerFor(flatWorld, 5, 11, 1, below, capOccluderFor)).toBe(capContainer);
    expect(calls).toEqual([[11, 1, 0]]);
  });

  it("D: routes a pit floor (h=-1) through capOccluderFor with 1 tile of overhang below", () => {
    const calls: Array<[number, number | undefined, number | undefined]> = [];
    const capOccluderFor = (vy: number, above?: number, belowOverhang?: number) => {
      calls.push([vy, above, belowOverhang]);
      return capContainer;
    };
    expect(surfaceContainerFor(flatWorld, 5, 12, -1, below, capOccluderFor)).toBe(capContainer);
    expect(calls).toEqual([[12, 0, 1]]);
  });

  it("D (south rim): a FLAT cell with a pit floor directly north strips with no overhang, so its row depth can cover the intruding cap and the dweller", () => {
    const calls: Array<[number, number | undefined, number | undefined]> = [];
    const capOccluderFor = (vy: number, above?: number, belowOverhang?: number) => {
      calls.push([vy, above, belowOverhang]);
      return capContainer;
    };
    const world = heightRead({ "5,12": -1 });
    expect(surfaceContainerFor(world, 5, 13, 0, below, capOccluderFor)).toBe(capContainer);
    expect(calls).toEqual([[13, 0, 0]]);
  });
});

// --- Cap depth ordering (chunkVisual.ts's bakeCapRows) ---
//
// A cap's own row `vy` is walkable ground: an entity standing ANYWHERE on it
// (feetWorldY in [vy, vy+1)) must draw IN FRONT of its own cap, while an
// entity at ANY feet position strictly north (feetWorldY < vy) must be
// occluded BY it. Every feet position below is hand-picked to include the
// MID-ROW fractional cases the old depthForOccluder(vy - 1) key got wrong —
// it only cleared feet at exactly the row boundary, so a body standing
// mid-row north of a raised south neighbor drew over the cap.
describe("cap depth ordering — depthForCapOccluder(vy)", () => {
  it("never occludes an entity standing anywhere on its own cap row", () => {
    for (const vy of [-5, 0, 1, 2, 10]) {
      for (const feet of [vy, vy + 0.3, vy + 0.5, vy + 0.97]) {
        expect(depthForCapOccluder(vy), `vy ${vy} feet ${feet}`).toBeLessThan(depthForEntity(feet));
      }
    }
  });

  it("occludes an entity at any feet position strictly north of the cap's row", () => {
    // 0.03 north of the boundary up to nearly a full row north — BODY_RADIUS
    // keeps real feet centers at least ~0.3 from a cell edge, so the extreme
    // sub-0.005 sliver depthForCapOccluder concedes is physically unreachable.
    for (const vy of [-5, 0, 1, 2, 10]) {
      for (const feet of [vy - 0.03, vy - 0.5, vy - 0.97]) {
        expect(depthForCapOccluder(vy), `vy ${vy} feet ${feet}`).toBeGreaterThan(depthForEntity(feet));
      }
    }
  });
});
