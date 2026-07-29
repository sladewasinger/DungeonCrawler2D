import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, ROOM_REGION_CY, TILE } from "@dc2d/engine";
import { terrainFeatureAt } from "../tileFeatures.js";
import { roomTerrainPresentation } from "../../runtime/roomPresentation.js";

describe("room terrain rendering policy", () => {
  it("uses inside presentation only in reserved room chunks", () => {
    expect(roomTerrainPresentation((ROOM_REGION_CY - 1) * CHUNK_SIZE).mode)
      .toBe("outside");
    expect(roomTerrainPresentation(ROOM_REGION_CY * CHUNK_SIZE).mode)
      .toBe("inside");
  });

  it("reads doors from the independent feature plane", () => {
    const featureAt = (_x: number, y: number): number =>
      y === 4 ? TILE.DoorPersonal : TILE.Floor;

    expect(terrainFeatureAt({ featureAt }, 4, 4)).toBe("door");
    expect(terrainFeatureAt({ featureAt }, 4, 5)).toBeNull();
  });
});
