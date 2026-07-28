import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { CHUNK_SIZE } from "../../core/types.js";
import { WORLD_GENERATION_TUNING } from "../tuning.js";
import { partitionChunk } from "./bsp.js";
import { DISTRICT } from "./district.js";

const DISTRICTS = Object.values(DISTRICT);

describe("BSP room dimensions", () => {
  it("honors the configured minimum room span across layouts", () => {
    const minimum = WORLD_GENERATION_TUNING.roomLayout.minimumRoomSpan;
    for (let index = 0; index < 40; index++) {
      const seed = hashString(`bsp-room-span-${index}`);
      for (const district of DISTRICTS) {
        const layout = partitionChunk(seed, CHUNK_SIZE, district);
        for (const room of layout.rooms) {
          expect(room.rect.x1 - room.rect.x0 + 1).toBeGreaterThanOrEqual(minimum);
          expect(room.rect.y1 - room.rect.y0 + 1).toBeGreaterThanOrEqual(minimum);
        }
      }
    }
  });
});
