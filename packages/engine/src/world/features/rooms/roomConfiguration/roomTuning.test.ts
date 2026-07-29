import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../../../core/types.js";
import { ROOM_TUNING } from "./roomTuning.js";

describe("room tuning", () => {
  it("keeps every authored room and its exit inside one chunk", () => {
    const rooms = [
      ROOM_TUNING.personal,
      ROOM_TUNING.party,
      ROOM_TUNING.safe,
      ROOM_TUNING.spawn,
    ];
    for (const room of rooms) {
      expect(room.width).toBeLessThan(CHUNK_SIZE);
      expect(room.height + ROOM_TUNING.southExitHallDepth)
        .toBeLessThan(CHUNK_SIZE);
    }
  });

  it("keeps the spawn slot grid internally consistent", () => {
    const { slotCount, columns } = ROOM_TUNING.spawn;
    expect(slotCount).toBeGreaterThan(0);
    expect(columns).toBeGreaterThan(0);
    expect(slotCount % columns).toBe(0);
  });
});
