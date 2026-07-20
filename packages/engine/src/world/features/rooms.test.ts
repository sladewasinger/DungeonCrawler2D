// Safe-room door count: v1's actual design (reference/engine/world/features/
// rooms.ts, reference/game-server/sim/actions.ts) places a DoorPersonal AND a
// DoorParty in every generated safe room, unconditionally — geometry is
// per-chunk deterministic (ENGINEERING_STANDARDS.md), not per-player, so it
// cannot vary by who's looking at it. The party door being non-functional for
// a solo player is enforced at interaction time (game-server), never by
// hiding the tile. See docs/ASSUMPTIONS.md #86.
import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, TILE } from "../types.js";
import { generateRoomChunk, partyRoomChunk, safeRoomChunk, safeRoomFeatures } from "./rooms.js";

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

  // docs/ROADMAP.md's filed ruling (2026-07-20): "exit doors default to the
  // north/back wall" — a safe room's exit no longer floats on the south
  // wall line now that its north row has a free center column.
  it("the safe room's exit sits on the north wall, not the south", () => {
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
    expect(tileAt(f.exit.x, f.exit.y)).toBe(TILE.DoorExit);
    expect(f.exit.y).toBe(f.doorPersonal.y); // same north row as the portal doors
    expect(f.exit.x).toBe(f.doorPersonal.x + 2); // dead center, between the two portals
  });
});

describe("party room's south exit alcove", () => {
  // The party room's north row is spent on the shared DoorPersonal
  // (each member's own room, same tile, per-player destination), so its
  // exit is the "south exit required" case the filed ruling calls out:
  // a short recessed inset with a glowing mouth, not a door floating flush
  // on the wall line.
  it("cuts a 2-tile alcove through the south wall at the exit's column", () => {
    const { cx, cy } = partyRoomChunk(0);
    const chunk = generateRoomChunk(cx, cy);
    const exitLi = chunk.tiles.findIndex((t) => t === TILE.DoorExit);
    expect(exitLi).toBeGreaterThanOrEqual(0);
    const exitLx = exitLi % CHUNK_SIZE;
    const exitLy = (exitLi - exitLx) / CHUNK_SIZE;

    // Door sits one row inside the room; the wall row directly south of it,
    // and one more row past the wall, are both carved open (the alcove).
    expect(chunk.tiles[(exitLy + 1) * CHUNK_SIZE + exitLx]).toBe(TILE.Floor);
    expect(chunk.tiles[(exitLy + 2) * CHUNK_SIZE + exitLx]).toBe(TILE.Floor);
    // The alcove is a 1-wide dead end, not a broader breach in the wall.
    expect(chunk.tiles[(exitLy + 1) * CHUNK_SIZE + exitLx - 1]).toBe(TILE.Wall);
    expect(chunk.tiles[(exitLy + 1) * CHUNK_SIZE + exitLx + 1]).toBe(TILE.Wall);
    expect(chunk.tiles[(exitLy + 3) * CHUNK_SIZE + exitLx]).toBe(TILE.Wall);
  });
});
