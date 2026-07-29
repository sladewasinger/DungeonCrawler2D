import { describe, expect, it } from "vitest";
import {
  CHUNK_SIZE,
  ROOM_REGION_CY,
  safeRoomChunk,
  safeRoomDoorPlacements,
} from "@dc2d/engine";
import { depthForEntity } from "../entities/presentation/depthSort.js";
import {
  roomFloorLabelPosition,
  SAFE_ROOM_BUBBLE_DEPTH,
  SAFE_ROOM_PRESENTATION_DEPTH,
} from "./roomPresentation.js";
import {
  isRoomDoorScreenFacing,
  roomDoorMount,
} from "./roomDoorPlacement.js";

describe("room floor label placement", () => {
  it("keeps the personal-room title clear of its fixtures", () => {
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

describe("wall-mounted room doors", () => {
  it("anchors north and east thresholds to their wall planes", () => {
    const room = { kind: "safe" as const, ...safeRoomChunk(4, 7) };
    const doors = safeRoomDoorPlacements(room.cx, room.cy);
    const north = doors.find((door) => door.wall === "north");
    const east = doors.find((door) => door.wall === "east");
    if (!north || !east) throw new Error("safe room wall placements are incomplete");

    expect(roomDoorMount(room, north)?.anchor).toEqual({ x: north.x + 0.5, y: north.y + 1 });
    expect(roomDoorMount(room, east)?.anchor).toEqual({ x: east.x, y: east.y + 0.5 });
  });

  it("shows a wall label only when that wall faces screen-south", () => {
    const room = { kind: "safe" as const, ...safeRoomChunk(4, 7) };
    const north = safeRoomDoorPlacements(room.cx, room.cy)
      .find((door) => door.wall === "north");
    if (!north) throw new Error("safe room north wall placement is missing");
    const mount = roomDoorMount(room, north);
    if (!mount) throw new Error("safe room north wall mount is missing");

    expect(isRoomDoorScreenFacing(mount, 0)).toBe(true);
    expect(isRoomDoorScreenFacing(mount, 90)).toBe(false);
    expect(isRoomDoorScreenFacing(mount, 180)).toBe(false);
    expect(isRoomDoorScreenFacing(mount, 270)).toBe(false);
  });
});
