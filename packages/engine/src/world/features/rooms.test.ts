// Safe-room door count: v1's actual design (reference/engine/world/features/
// rooms.ts, reference/game-server/sim/actions.ts) places a DoorPersonal AND a
// DoorParty in every generated safe room, unconditionally — geometry is
// per-chunk deterministic (ENGINEERING_STANDARDS.md), not per-player, so it
// cannot vary by who's looking at it. The party door being non-functional for
// a solo player is enforced at interaction time (game-server), never by
// hiding the tile. See docs/ASSUMPTIONS.md #86.
import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, TILE } from "../types.js";
import { generateRoomChunk, safeRoomChunk, safeRoomFeatures } from "./rooms.js";

function countTile(tiles: Uint8Array, tile: number): number {
  let n = 0;
  for (const t of tiles) if (t === tile) n++;
  return n;
}

describe("safe room doors", () => {
  it("every safe room has exactly one personal door and one party door, always — never zero, never duplicated", () => {
    for (let doorCx = -20; doorCx <= 20; doorCx += 3) {
      for (let doorCy = -20; doorCy <= 20; doorCy += 3) {
        const { cx, cy } = safeRoomChunk(doorCx, doorCy);
        const chunk = generateRoomChunk(cx, cy);
        expect(countTile(chunk.tiles, TILE.DoorPersonal), `door (${doorCx},${doorCy})`).toBe(1);
        expect(countTile(chunk.tiles, TILE.DoorParty), `door (${doorCx},${doorCy})`).toBe(1);
      }
    }
  });

  it("safeRoomFeatures' reported coordinates match the tiles the generator actually carved", () => {
    const doorCx = 4;
    const doorCy = 7;
    const { cx, cy } = safeRoomChunk(doorCx, doorCy);
    const chunk = generateRoomChunk(cx, cy);
    const f = safeRoomFeatures(doorCx, doorCy);

    const tileAt = (wx: number, wy: number): number => {
      const lx = wx - cx * CHUNK_SIZE;
      const ly = wy - cy * CHUNK_SIZE;
      return chunk.tiles[ly * CHUNK_SIZE + lx] ?? -1;
    };
    expect(tileAt(f.doorPersonal.x, f.doorPersonal.y)).toBe(TILE.DoorPersonal);
    expect(tileAt(f.doorParty.x, f.doorParty.y)).toBe(TILE.DoorParty);
  });
});
