import { describe, expect, it } from "vitest";
import { DUNGEON_AUTO_HEALING_LABEL } from "./HudBuffs.js";

describe("HUD buff labels", () => {
  it("presents auto healing as Dungeon Auto Healing", () => {
    expect(DUNGEON_AUTO_HEALING_LABEL).toBe("Dungeon Auto Healing");
  });
});
