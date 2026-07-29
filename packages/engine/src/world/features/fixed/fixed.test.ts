import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, FEATURE_FACE, TILE } from "../../core/types.js";
import { WORLD_GENERATION_TUNING } from "../../generate/tuning.js";
import { carveSafeRoomEntrance, KIOSK_HEIGHT } from "./fixed.js";

const CENTER_LX = 10;
const CENTER_LY = 10;
const KIOSK = WORLD_GENERATION_TUNING.fixedFeatures;
/** Rows north of the door row a real flat-top platform needs behind its face rows (fixed.ts's TERRACE_TOP_ROWS). */
const REQUIRED_FLAT_TOP_ROWS = KIOSK.kioskTopDepth;

function entranceBuffers(): {
  tiles: Uint8Array;
  featureTiles: Uint8Array;
  featureFaces: Uint8Array;
  featureHeight: Float32Array;
  height: Float32Array;
} {
  const cells = CHUNK_SIZE * CHUNK_SIZE;
  return {
    tiles: new Uint8Array(cells).fill(TILE.Floor),
    featureTiles: new Uint8Array(cells),
    featureFaces: new Uint8Array(cells),
    featureHeight: new Float32Array(cells),
    height: new Float32Array(cells),
  };
}

function kioskCells(): Array<{ x: number; y: number }> {
  const width = KIOSK.kioskHalfWidth * 2 + 1;
  const depth = KIOSK_HEIGHT + KIOSK.kioskTopDepth + 1;
  const northReach = KIOSK_HEIGHT + KIOSK.kioskTopDepth - 1;
  return Array.from({ length: width * depth }, (_, index) => ({
    x: CENTER_LX - KIOSK.kioskHalfWidth + index % width,
    y: CENTER_LY - northReach + Math.floor(index / width),
  }));
}

describe("carveSafeRoomEntrance", () => {
  it("builds a broad 5-wide kiosk TERRACE (walkable raised floor) with one portal in its south face", () => {
    const buffers = entranceBuffers();
    carveSafeRoomEntrance({ ...buffers, centerLx: CENTER_LX, centerLy: CENTER_LY });

    for (const { x, y } of kioskCells()) {
      const index = y * CHUNK_SIZE + x;
      expect(buffers.tiles[index]).toBe(TILE.Floor);
      expect(buffers.height[index]).toBe(KIOSK_HEIGHT);
    }
    const doorIndex = (CENTER_LY + 1) * CHUNK_SIZE + CENTER_LX;
    expect(buffers.featureTiles[doorIndex]).toBe(TILE.DoorSafeRoom);
    expect(buffers.featureFaces[doorIndex]).toBe(FEATURE_FACE.South);
    expect(buffers.featureHeight[doorIndex]).toBe(1);
    const outsideWest = CENTER_LX - KIOSK.kioskHalfWidth - 1;
    expect(buffers.tiles[CENTER_LY * CHUNK_SIZE + outsideWest]).toBe(TILE.Floor);
    expect(buffers.tiles[(CENTER_LY + 2) * CHUNK_SIZE + CENTER_LX]).toBe(TILE.Floor);
  });

  it("is 5 deep north-to-south — enough for its own face rows PLUS a real flat-top platform behind them (docs/ROADMAP.md's 'deepen the platform above the door' user spec)", () => {
    const buffers = entranceBuffers();
    carveSafeRoomEntrance({ ...buffers, centerLx: CENTER_LX, centerLy: CENTER_LY });

    let depth = 0;
    for (let y = 0; y < CHUNK_SIZE; y++) {
      const westEdge = CENTER_LX - KIOSK.kioskHalfWidth;
      if (buffers.height[y * CHUNK_SIZE + westEdge] === KIOSK_HEIGHT) depth++;
    }
    expect(depth).toBe(KIOSK_HEIGHT + KIOSK.kioskTopDepth + 1);
  });

  it("the door's OWN column has at least REQUIRED_FLAT_TOP_ROWS of terrace north of its face rows — the exact 'notch directly above the door' bug: every other column already had this depth, only the door's column came up short", () => {
    const buffers = entranceBuffers();
    carveSafeRoomEntrance({ ...buffers, centerLx: CENTER_LX, centerLy: CENTER_LY });

    // ownFace.ts's face model: a flush height-KIOSK_HEIGHT drop consumes
    // exactly KIOSK_HEIGHT rows of face immediately south-adjacent to the
    // drop. On the door's own column, that drop is the door itself (one row
    // south of the terrace), so rows [doorY-1-KIOSK_HEIGHT, doorY-2] are the
    // required flat-top band.
    const doorY = CENTER_LY + 1;
    for (let n = 1; n <= REQUIRED_FLAT_TOP_ROWS; n++) {
      const y = doorY - KIOSK_HEIGHT - n;
      expect(buffers.height[y * CHUNK_SIZE + CENTER_LX], `row ${y} at the door's column`).toBe(KIOSK_HEIGHT);
    }
  });

  it("keeps the kiosk wall intact beneath its independent z1 door feature", () => {
    const buffers = entranceBuffers();
    carveSafeRoomEntrance({ ...buffers, centerLx: CENTER_LX, centerLy: CENTER_LY });

    const doorY = CENTER_LY + 1;
    const doorIndex = doorY * CHUNK_SIZE + CENTER_LX;
    expect(buffers.tiles[doorIndex]).toBe(TILE.Floor);
    expect(buffers.height[doorIndex]).toBe(KIOSK_HEIGHT);
    expect(buffers.featureTiles[doorIndex]).toBe(TILE.DoorSafeRoom);
    expect(buffers.featureFaces[doorIndex]).toBe(FEATURE_FACE.South);
    expect(buffers.featureHeight[doorIndex]).toBe(1);
    expect(buffers.height[(doorY + 1) * CHUNK_SIZE + CENTER_LX]).toBe(0);
  });
});
