// Pure bitmask autotiling math — no Phaser, no world reads. A caller hands in a
// `solid(dx, dy)` probe ("is the neighbor at this offset the same material?") and
// gets back the 8-bit neighbor mask plus the derived 4-bit cardinal mask, which
// tile edges should carry a border, and which inner corners want a refinement
// dot. Bit order for the 8-bit mask is compass-clockwise starting at north:
// N, NE, E, SE, S, SW, W, NW (bit 0 .. bit 7) — matches the user's own
// "N,NE,E,SE,S,SW,W,NW" spec order exactly, so a hex dump reads left-to-right
// as compass order.
//
// The 4-bit cardinal mask packs N,E,S,W into bits 0..3 (in that order) — 16
// variants, index-compatible with the debug tileset's WALL_FRAME_BASE + mask4
// frame layout (debugTileset.ts).

export type SolidAt = (dx: number, dy: number) => boolean;

/** Offsets for the 8-bit mask's bit order: index 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW. */
const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
]; // prettier-ignore

const N_BIT = 1 << 0;
const NE_BIT = 1 << 1;
const E_BIT = 1 << 2;
const SE_BIT = 1 << 3;
const S_BIT = 1 << 4;
const SW_BIT = 1 << 5;
const W_BIT = 1 << 6;
const NW_BIT = 1 << 7;

/** Computes the 8-bit neighbor mask by probing all 8 offsets in N..NW order. */
export function neighborMask8(solid: SolidAt): number {
  let mask = 0;
  for (let i = 0; i < NEIGHBOR_OFFSETS.length; i++) {
    const [dx, dy] = NEIGHBOR_OFFSETS[i]!;
    if (solid(dx, dy)) mask |= 1 << i;
  }
  return mask;
}

/** Reduces an 8-bit mask to the 4-bit cardinal mask: bit0=N, bit1=E, bit2=S, bit3=W. */
export function cardinalMask4(mask8: number): number {
  let m = 0;
  if (mask8 & N_BIT) m |= 1;
  if (mask8 & E_BIT) m |= 2;
  if (mask8 & S_BIT) m |= 4;
  if (mask8 & W_BIT) m |= 8;
  return m;
}

export interface CardinalEdges {
  readonly north: boolean;
  readonly east: boolean;
  readonly south: boolean;
  readonly west: boolean;
}

/** Which edges of a mask4 wall tile draw a border: exactly the edges whose cardinal neighbor is NOT the same material. */
export function edgesForMask4(mask4: number): CardinalEdges {
  return {
    north: (mask4 & 1) === 0,
    east: (mask4 & 2) === 0,
    south: (mask4 & 4) === 0,
    west: (mask4 & 8) === 0,
  };
}

export interface InnerCorners {
  readonly ne: boolean;
  readonly se: boolean;
  readonly sw: boolean;
  readonly nw: boolean;
}

/**
 * 8-bit corner refinement: a corner gets an "inner corner" dot when BOTH its
 * adjacent cardinals are the same material but the diagonal between them is
 * NOT — the concave-notch case a 4-bit mask alone can't distinguish from a
 * fully-open corner (both would otherwise render identically).
 */
export function innerCorners(mask8: number): InnerCorners {
  const n = (mask8 & N_BIT) !== 0;
  const e = (mask8 & E_BIT) !== 0;
  const s = (mask8 & S_BIT) !== 0;
  const w = (mask8 & W_BIT) !== 0;
  return {
    ne: n && e && (mask8 & NE_BIT) === 0,
    se: s && e && (mask8 & SE_BIT) === 0,
    sw: s && w && (mask8 & SW_BIT) === 0,
    nw: n && w && (mask8 & NW_BIT) === 0,
  };
}

export interface WallAutotile {
  readonly mask8: number;
  readonly mask4: number;
  readonly edges: CardinalEdges;
  readonly corners: InnerCorners;
}

/** One-call convenience: every derived value a wall cell's renderer needs from one `solid` probe. */
export function solveWallAutotile(solid: SolidAt): WallAutotile {
  const mask8 = neighborMask8(solid);
  const mask4 = cardinalMask4(mask8);
  return { mask8, mask4, edges: edgesForMask4(mask4), corners: innerCorners(mask8) };
}

/** "0x0F" style hex readout for the editor inspector/debug overlay — always zero-padded to 2 hex digits. */
export function maskHex(mask: number): string {
  return `0x${mask.toString(16).toUpperCase().padStart(2, "0")}`;
}
