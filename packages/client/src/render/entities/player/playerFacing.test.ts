import { describe, expect, it } from "vitest";
import type { PlayerEntityView } from "../visuals/view.js";
import { playerFacesLeft } from "./playerFacing.js";

describe("assisted player sprite facing", () => {
  it("follows movement aim while not attacking", () => {
    expect(playerFacesLeft(Math.PI, view({ attacking: false }))).toBe(true);
  });

  it("faces an acquired assisted target during the attack pulse", () => {
    const targetLeft = view({ attacking: true, attackAngleRad: Math.PI });
    expect(playerFacesLeft(0, targetLeft)).toBe(true);
  });

  it("preserves unarmed desktop movement-facing", () => {
    const desktop = view({ assistedAim: false, faceX: -1 });
    expect(playerFacesLeft(0, desktop)).toBe(true);
  });
});

function view(overrides: Partial<PlayerEntityView>): PlayerEntityView {
  return {
    id: "self",
    playerId: "self",
    name: "Crawler",
    x: 0,
    y: 0,
    z: 0,
    hp: 30,
    maxHp: 30,
    fx: [],
    faceX: 1,
    faceY: 0,
    air: false,
    downed: false,
    attacking: false,
    blocking: false,
    weaponId: null,
    weaponAimAngle: 0,
    assistedAim: true,
    attackAngleRad: 0,
    ...overrides,
  };
}
