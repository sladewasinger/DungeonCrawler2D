import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, ROOM_REGION_CY, TILE } from "@dc2d/engine";
import { terrainFeatureAt } from "../tileFeatures.js";
import { roomVoidBoundaryStyle } from "../../runtime/roomTerrainPolicy.js";

describe("room terrain rendering policy", () => {
  it("uses flat VOID boundaries only in reserved room chunks", () => {
    expect(roomVoidBoundaryStyle((ROOM_REGION_CY - 1) * CHUNK_SIZE)).toBe("floating");
    expect(roomVoidBoundaryStyle(ROOM_REGION_CY * CHUNK_SIZE)).toBe("flat");
  });

  it("reads doors from the independent feature plane", () => {
    const featureAt = (_x: number, y: number): number =>
      y === 4 ? TILE.DoorPersonal : TILE.Floor;

    expect(terrainFeatureAt({ featureAt }, 4, 4)).toBe("door");
    expect(terrainFeatureAt({ featureAt }, 4, 5)).toBeNull();
  });
});
