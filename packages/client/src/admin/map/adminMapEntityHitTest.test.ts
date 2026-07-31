import { describe, expect, it } from "vitest";
import type { AdminMap } from "@dc2d/engine";
import {
  adminMapEntityScreenPoint,
  deletableAdminEntityAt,
} from "./adminMapEntityHitTest.js";

const canvas = { width: 480, height: 360 };
const center = { x: 10.5, y: 10.5 };

describe("admin map entity hit testing", () => {
  it("renders a tile-centred world position in the visual centre of its cell", () => {
    expect(adminMapEntityScreenPoint({
      world: { x: 10.5, y: 10.5 },
      center,
      canvas,
    })).toEqual({
      x: 240,
      y: 180,
    });
  });

  it("offers only enemy and weapon markers to the contextual delete action", () => {
    const enemy = { id: "e9", kind: "enemy" as const, x: 10.5, y: 10.5, z: 0 };
    const weapon = { id: "i10", kind: "weapon" as const, x: 11.5, y: 10.5, z: 0 };
    const map: AdminMap = {
      level: "dungeon",
      floor: 1,
      center,
      radius: 10,
      cells: [],
      entities: [enemy, weapon, { id: "i11", kind: "item", x: 12.5, y: 10.5, z: 0 }],
    };

    expect(deletableAdminEntityAt({ map, center, canvas, point: { x: 264, y: 180 } })?.id)
      .toBe("i10");
    expect(deletableAdminEntityAt({ map, center, canvas, point: { x: 288, y: 180 } }))
      .toBeNull();
  });

  it("keeps adjacent deletion targets disjoint at minimum zoom", () => {
    const first = { id: "e1", kind: "enemy" as const, x: 10.5, y: 10.5, z: 0 };
    const second = { id: "e2", kind: "enemy" as const, x: 11.5, y: 10.5, z: 0 };
    const map: AdminMap = {
      level: "dungeon",
      floor: 1,
      center,
      radius: 10,
      cells: [],
      entities: [first, second],
    };

    expect(deletableAdminEntityAt({
      map,
      center,
      canvas,
      tileSize: 18,
      point: { x: 248, y: 180 },
    })?.id).toBe("e1");
    expect(deletableAdminEntityAt({
      map,
      center,
      canvas,
      tileSize: 18,
      point: { x: 249, y: 180 },
    })).toBeNull();
  });
});
