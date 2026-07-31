import { describe, expect, it } from "vitest";
import type { AdminMap, AdminPlayer } from "@dc2d/engine";
import { petOwnerForAdminMap } from "./adminPetPlacement.js";

const PLAYER = {
  playerId: "player-1",
  connected: true,
  level: "dungeon",
  floor: 2,
} as AdminPlayer;

const MAP = {
  level: "dungeon",
  floor: 2,
} as AdminMap;

describe("admin pet placement ownership", () => {
  it("uses the selected player only while they are on the edited map", () => {
    expect(petOwnerForAdminMap(PLAYER, MAP)).toBe("player-1");
  });

  it("does not create a pet owner for another floor or no selection", () => {
    expect(petOwnerForAdminMap({ ...PLAYER, floor: 1 }, MAP)).toBeNull();
    expect(petOwnerForAdminMap({ ...PLAYER, connected: false }, MAP)).toBeNull();
    expect(petOwnerForAdminMap(null, MAP)).toBeNull();
  });
});
