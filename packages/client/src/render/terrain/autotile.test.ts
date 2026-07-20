import { describe, expect, it } from "vitest";
import { cardinalMask4, edgesForMask4, innerCorners, maskHex, neighborMask8, solveWallAutotile, type SolidAt } from "./autotile.js";

/** Builds a `solid` probe from an explicit set of "true" offsets — everything else reads false. */
function solidFrom(trueOffsets: ReadonlyArray<readonly [number, number]>): SolidAt {
  const keys = new Set(trueOffsets.map(([dx, dy]) => `${dx},${dy}`));
  return (dx, dy) => keys.has(`${dx},${dy}`);
}

const NONE: SolidAt = () => false;
const ALL8: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
]; // prettier-ignore

describe("neighborMask8", () => {
  it("is 0 when nothing is solid", () => {
    expect(neighborMask8(NONE)).toBe(0);
  });

  it("is 0xFF when every neighbor is solid", () => {
    expect(neighborMask8(solidFrom(ALL8))).toBe(0xff);
  });

  // Bit order N, NE, E, SE, S, SW, W, NW (bit 0 .. bit 7) — one offset solid at a time.
  const SINGLE_BIT_CASES: ReadonlyArray<{ name: string; offset: readonly [number, number]; bit: number }> = [
    { name: "N", offset: [0, -1], bit: 0 },
    { name: "NE", offset: [1, -1], bit: 1 },
    { name: "E", offset: [1, 0], bit: 2 },
    { name: "SE", offset: [1, 1], bit: 3 },
    { name: "S", offset: [0, 1], bit: 4 },
    { name: "SW", offset: [-1, 1], bit: 5 },
    { name: "W", offset: [-1, 0], bit: 6 },
    { name: "NW", offset: [-1, -1], bit: 7 },
  ];

  for (const { name, offset, bit } of SINGLE_BIT_CASES) {
    it(`sets only bit ${bit} for a lone ${name} neighbor`, () => {
      expect(neighborMask8(solidFrom([offset]))).toBe(1 << bit);
    });
  }
});

describe("cardinalMask4", () => {
  it("packs N,E,S,W into bits 0..3 and ignores every diagonal", () => {
    // mask8 with all 4 diagonals set but no cardinals -> mask4 stays 0.
    expect(cardinalMask4(0b1010_1010)).toBe(0);
    // mask8 with all 4 cardinals set (and no diagonals) -> mask4 is 0b1111.
    expect(cardinalMask4(0b0101_0101)).toBe(0b1111);
  });

  // Exhaustive: every one of the 16 cardinal-only combinations round-trips through
  // neighborMask8 -> cardinalMask4 to the same 4-bit value, with diagonals along for
  // the ride (set whenever a case has an odd combination) to prove they never leak in.
  for (let mask4 = 0; mask4 <= 15; mask4++) {
    it(`reduces cardinal combination ${mask4} (0x${mask4.toString(16)}) back to itself`, () => {
      const offsets: Array<readonly [number, number]> = [];
      if (mask4 & 1) offsets.push([0, -1]); // N
      if (mask4 & 2) offsets.push([1, 0]); // E
      if (mask4 & 4) offsets.push([0, 1]); // S
      if (mask4 & 8) offsets.push([-1, 0]); // W
      // Throw every diagonal in too — cardinalMask4 must ignore them regardless.
      offsets.push([1, -1], [1, 1], [-1, 1], [-1, -1]);
      expect(cardinalMask4(neighborMask8(solidFrom(offsets)))).toBe(mask4);
    });
  }
});

describe("edgesForMask4 — all 16 cardinal cases, table-driven mask -> expected border edges", () => {
  const CASES: ReadonlyArray<{
    mask4: number;
    north: boolean;
    east: boolean;
    south: boolean;
    west: boolean;
  }> = [
    { mask4: 0b0000, north: true, east: true, south: true, west: true }, // isolated: border all 4 sides
    { mask4: 0b0001, north: false, east: true, south: true, west: true }, // N neighbor only
    { mask4: 0b0010, north: true, east: false, south: true, west: true }, // E neighbor only
    { mask4: 0b0011, north: false, east: false, south: true, west: true }, // N+E
    { mask4: 0b0100, north: true, east: true, south: false, west: true }, // S neighbor only
    { mask4: 0b0101, north: false, east: true, south: false, west: true }, // N+S straight run
    { mask4: 0b0110, north: true, east: false, south: false, west: true }, // E+S
    { mask4: 0b0111, north: false, east: false, south: false, west: true }, // N+E+S (T, open W)
    { mask4: 0b1000, north: true, east: true, south: true, west: false }, // W neighbor only
    { mask4: 0b1001, north: false, east: true, south: true, west: false }, // N+W
    { mask4: 0b1010, north: true, east: false, south: true, west: false }, // E+W straight run
    { mask4: 0b1011, north: false, east: false, south: true, west: false }, // N+E+W (T, open S)
    { mask4: 0b1100, north: true, east: true, south: false, west: false }, // S+W
    { mask4: 0b1101, north: false, east: true, south: false, west: false }, // N+S+W (T, open E)
    { mask4: 0b1110, north: true, east: false, south: false, west: false }, // E+S+W (T, open N)
    { mask4: 0b1111, north: false, east: false, south: false, west: false }, // X junction / full interior: no border
  ];

  for (const { mask4, ...expected } of CASES) {
    it(`mask4=${mask4} (${mask4.toString(2).padStart(4, "0")}) -> ${JSON.stringify(expected)}`, () => {
      expect(edgesForMask4(mask4)).toEqual(expected);
    });
  }
});

describe("innerCorners", () => {
  // Base: every cardinal present (mask 0b0101_0101 = N,E,S,W all set), no diagonals —
  // every corner should want its dot, since all 4 corners have both cardinals but no diagonal.
  const ALL_CARDINALS = 0b0101_0101;

  it("wants every corner dot when all 4 cardinals are set and no diagonal is", () => {
    expect(innerCorners(ALL_CARDINALS)).toEqual({ ne: true, se: true, sw: true, nw: true });
  });

  it("wants no corner dots once every diagonal fills in too (fully solid mass)", () => {
    expect(innerCorners(0xff)).toEqual({ ne: false, se: false, sw: false, nw: false });
  });

  const CORNER_BITS: Readonly<Record<"ne" | "se" | "sw" | "nw", number>> = {
    ne: 1 << 1,
    se: 1 << 3,
    sw: 1 << 5,
    nw: 1 << 7,
  };

  for (const corner of ["ne", "se", "sw", "nw"] as const) {
    it(`${corner}: true when both adjacent cardinals set but the diagonal is not`, () => {
      const mask8 = ALL_CARDINALS & ~CORNER_BITS[corner];
      expect(innerCorners(mask8)[corner]).toBe(true);
    });

    it(`${corner}: false when both adjacent cardinals AND the diagonal are set`, () => {
      const mask8 = ALL_CARDINALS | CORNER_BITS[corner];
      expect(innerCorners(mask8)[corner]).toBe(false);
    });

    it(`${corner}: false when the diagonal is set but a cardinal is missing`, () => {
      // Drop one of the two cardinals adjacent to this corner (N for ne/nw, S for se/sw is
      // representative enough — the point is "not BOTH cardinals" short-circuits the dot).
      const dropCardinal = corner === "ne" || corner === "nw" ? (1 << 0) : (1 << 4); // N_BIT or S_BIT
      const mask8 = ALL_CARDINALS & ~dropCardinal;
      expect(innerCorners(mask8)[corner]).toBe(false);
    });

    it(`${corner}: false when neither cardinal nor diagonal is set`, () => {
      expect(innerCorners(0)[corner]).toBe(false);
    });
  }
});

describe("solveWallAutotile", () => {
  it("bundles mask8/mask4/edges/corners consistently for an isolated wall", () => {
    const result = solveWallAutotile(NONE);
    expect(result.mask8).toBe(0);
    expect(result.mask4).toBe(0);
    expect(result.edges).toEqual({ north: true, east: true, south: true, west: true });
    expect(result.corners).toEqual({ ne: false, se: false, sw: false, nw: false });
  });

  it("bundles mask8/mask4/edges/corners consistently for a fully interior wall", () => {
    const result = solveWallAutotile(solidFrom(ALL8));
    expect(result.mask8).toBe(0xff);
    expect(result.mask4).toBe(0b1111);
    expect(result.edges).toEqual({ north: false, east: false, south: false, west: false });
    expect(result.corners).toEqual({ ne: false, se: false, sw: false, nw: false });
  });

  it("bundles a straight N/S run with a concave-corner dot where the diagonal is missing", () => {
    // N + S solid, E open, W open, NE/NW/SE/SW all open: a thin N-S ridge.
    const result = solveWallAutotile(solidFrom([[0, -1], [0, 1]]));
    expect(result.mask4).toBe(0b0101);
    expect(result.edges).toEqual({ north: false, east: true, south: false, west: true });
    // No corner dots: NE needs both N AND E, but E is open here.
    expect(result.corners).toEqual({ ne: false, se: false, sw: false, nw: false });
  });

  it("bundles an L junction (N+E solid, NE diagonal open) with exactly one inner-corner dot", () => {
    const result = solveWallAutotile(solidFrom([[0, -1], [1, 0]]));
    expect(result.mask4).toBe(0b0011);
    expect(result.edges).toEqual({ north: false, east: false, south: true, west: true });
    expect(result.corners).toEqual({ ne: true, se: false, sw: false, nw: false });
  });
});

describe("maskHex", () => {
  it("zero-pads to 2 hex digits and upper-cases", () => {
    expect(maskHex(0)).toBe("0x00");
    expect(maskHex(0xf)).toBe("0x0F");
    expect(maskHex(0xff)).toBe("0xFF");
    expect(maskHex(0xa3)).toBe("0xA3");
  });
});
