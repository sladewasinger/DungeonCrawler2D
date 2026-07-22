import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, TILE } from "../types.js";
import { carveSafeRoomEntrance, KIOSK_HEIGHT } from "./fixed.js";

const CENTER_LX = 10;
const CENTER_LY = 10;
/** Rows north of the door row a real flat-top platform needs behind its face rows (fixed.ts's TERRACE_TOP_ROWS). */
const REQUIRED_FLAT_TOP_ROWS = KIOSK_HEIGHT;

describe("carveSafeRoomEntrance", () => {
  it("builds a broad 5-wide kiosk TERRACE (walkable raised floor, not rock) with one portal in its south face", () => {
    const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE.Floor);
    const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
    carveSafeRoomEntrance(tiles, height, CENTER_LX, CENTER_LY);

    for (let y = CENTER_LY - 3; y <= CENTER_LY + 1; y++) {
      for (let x = CENTER_LX - 2; x <= CENTER_LX + 2; x++) {
        const i = y * CHUNK_SIZE + x;
        const isDoor = x === CENTER_LX && y === CENTER_LY + 1;
        expect(tiles[i]).toBe(isDoor ? TILE.DoorSafeRoom : TILE.Floor);
        // The door cell itself drops to ground level (0) so a grounded body
        // can actually walk up to it — see carveSafeRoomEntrance's doc comment.
        expect(height[i]).toBe(KIOSK_HEIGHT);
      }
    }
    expect(tiles[CENTER_LY * CHUNK_SIZE + (CENTER_LX - 3)]).toBe(TILE.Floor);
    expect(tiles[(CENTER_LY + 2) * CHUNK_SIZE + CENTER_LX]).toBe(TILE.Floor);
  });

  it("is 5 deep north-to-south — enough for its own face rows PLUS a real flat-top platform behind them (docs/ROADMAP.md's 'deepen the platform above the door' user spec)", () => {
    const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE.Floor);
    const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
    carveSafeRoomEntrance(tiles, height, CENTER_LX, CENTER_LY);

    let depth = 0;
    for (let y = 0; y < CHUNK_SIZE; y++) {
      if (height[y * CHUNK_SIZE + (CENTER_LX - 2)] === KIOSK_HEIGHT) depth++;
    }
    expect(depth).toBe(2 * KIOSK_HEIGHT + 1);
  });

  it("the door's OWN column has at least REQUIRED_FLAT_TOP_ROWS of terrace north of its face rows — the exact 'notch directly above the door' bug: every other column already had this depth, only the door's column came up short", () => {
    const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE.Floor);
    const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
    carveSafeRoomEntrance(tiles, height, CENTER_LX, CENTER_LY);

    // ownFace.ts's face model: a flush height-KIOSK_HEIGHT drop consumes
    // exactly KIOSK_HEIGHT rows of face immediately south-adjacent to the
    // drop. On the door's own column, that drop is the door itself (one row
    // south of the terrace), so rows [doorY-1-KIOSK_HEIGHT, doorY-2] are the
    // required flat-top band.
    const doorY = CENTER_LY + 1;
    for (let n = 1; n <= REQUIRED_FLAT_TOP_ROWS; n++) {
      const y = doorY - KIOSK_HEIGHT - n;
      expect(height[y * CHUNK_SIZE + CENTER_LX], `row ${y} at the door's column`).toBe(KIOSK_HEIGHT);
    }
  });
});
