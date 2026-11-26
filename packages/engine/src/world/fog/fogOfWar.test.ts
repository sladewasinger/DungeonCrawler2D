/** Unit tests for Fog-of-War bitset geometry, reveal radii, deltas, and lossless encoding [REQ-P9-01]. */
import { describe, expect, it } from "vitest";
import {
  FOG_CELL_TILES,
  FOG_REVEAL_RADIUS_BASE,
  FOG_REVEAL_RADIUS_ELEVATED_DAY,
  applyFogChunkDeltas,
  countRevealedFogCells,
  createFogState,
  decodeFogMask,
  encodeFogMask,
  getChunkFogMask,
  isFogTileRevealed,
  revealFogAroundPlayer,
  revealRadiusFor,
} from "./fogOfWar.js";

describe("[REQ-P9-01] Fog-of-War bitset and encoding", () => {
  it("tracks 8x8 cells inside 32x32 chunks across negative and positive coords", () => {
    const fog = createFogState();
    const deltas = revealFogAroundPlayer(fog, { x: 0.5, y: 0.5, elevation: 0, isDaytime: true });
    expect(deltas.length).toBeGreaterThanOrEqual(4);
    expect(isFogTileRevealed(fog, 0.5, 0.5)).toBe(true);
    expect(isFogTileRevealed(fog, -10, -10)).toBe(true);
    expect(isFogTileRevealed(fog, FOG_CELL_TILES * 4, FOG_CELL_TILES * 4)).toBe(false);
    expect(getChunkFogMask(fog, 0, 0)).toBeGreaterThan(0);
    expect(getChunkFogMask(fog, -1, -1)).toBeGreaterThan(0);
  });

  it("uses 18-tile base radius and 22-tile elevated daytime radius", () => {
    expect(revealRadiusFor(0, true)).toBe(FOG_REVEAL_RADIUS_BASE);
    expect(revealRadiusFor(1, false)).toBe(FOG_REVEAL_RADIUS_BASE);
    expect(revealRadiusFor(1, true)).toBe(FOG_REVEAL_RADIUS_ELEVATED_DAY);

    const flatFog = createFogState();
    revealFogAroundPlayer(flatFog, { x: 4, y: 4, elevation: 0, isDaytime: true });
    const highFog = createFogState();
    revealFogAroundPlayer(highFog, { x: 4, y: 4, elevation: 1, isDaytime: true });
    expect(countRevealedFogCells(highFog)).toBeGreaterThan(countRevealedFogCells(flatFog));
  });

  it("emits incremental deltas only for newly explored cells and round-trips losslessly", () => {
    const serverFog = createFogState();
    const first = revealFogAroundPlayer(serverFog, { x: 0.5, y: 0.5, elevation: 0, isDaytime: true });
    expect(first.length).toBeGreaterThan(0);
    const repeat = revealFogAroundPlayer(serverFog, { x: 0.6, y: 0.6, elevation: 0, isDaytime: true });
    expect(repeat).toEqual([]);

    const stepOut = revealFogAroundPlayer(serverFog, { x: 64, y: -32, elevation: 1, isDaytime: true });
    expect(stepOut.length).toBeGreaterThan(0);

    const clientFog = createFogState();
    applyFogChunkDeltas(clientFog, first);
    applyFogChunkDeltas(clientFog, stepOut);

    const encoded = encodeFogMask(serverFog);
    expect(encoded.length).toBeGreaterThan(0);
    const restored = decodeFogMask(encoded);
    expect(encodeFogMask(restored)).toBe(encodeFogMask(clientFog));
    expect(countRevealedFogCells(restored)).toBe(countRevealedFogCells(serverFog));
    expect(isFogTileRevealed(restored, 64, -32)).toBe(true);
    expect(isFogTileRevealed(restored, 240, 240)).toBe(false);
    expect(encodeFogMask(decodeFogMask(""))).toBe("");
  });
});
