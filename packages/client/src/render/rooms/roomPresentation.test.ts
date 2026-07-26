import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, ROOM_REGION_CY } from "@dc2d/engine";
import { depthForEntity } from "../entities/depthSort.js";
import {
  roomFloorLabelPosition,
  SAFE_ROOM_BUBBLE_DEPTH,
  SAFE_ROOM_PRESENTATION_DEPTH,
} from "./roomPresentation.js";

describe("room floor label placement", () => {
  it("moves the personal-room title clear of its projected south wall", () => {
    expect(roomFloorLabelPosition("personal", { x: 16, y: 16 }))
      .toEqual({ x: 16, y: 14.5 });
  });

  it("keeps larger room titles at their geometric centers", () => {
    expect(roomFloorLabelPosition("party", { x: 16, y: 16 }))
      .toEqual({ x: 16, y: 16 });
    expect(roomFloorLabelPosition("safe", { x: 16, y: 16 }))
      .toEqual({ x: 16, y: 16 });
  });
});

describe("safe-room presentation depth", () => {
  it("keeps the nameplate and bubble above room terrain in stable order", () => {
    const deepestRoomRow = (ROOM_REGION_CY + 1) * CHUNK_SIZE;

    expect(SAFE_ROOM_PRESENTATION_DEPTH).toBeGreaterThan(
      depthForEntity(deepestRoomRow),
    );
    expect(SAFE_ROOM_BUBBLE_DEPTH).toBe(SAFE_ROOM_PRESENTATION_DEPTH + 1);
  });
});
