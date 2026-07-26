import { describe, expect, it } from "vitest";
import {
  PLAYER_GENDERS,
  PLAYER_MODELS,
  isPlayerSkin,
  playerSkin,
} from "./playerAppearance.js";

describe("player appearance", () => {
  it("maps every gender/model choice to an allowed atlas skin", () => {
    for (const gender of PLAYER_GENDERS) {
      for (const model of PLAYER_MODELS) {
        expect(isPlayerSkin(playerSkin(model, gender))).toBe(true);
      }
    }
  });

  it("rejects arbitrary sprite names", () => {
    expect(isPlayerSkin("slime")).toBe(false);
  });
});
