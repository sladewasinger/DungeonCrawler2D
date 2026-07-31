import { afterEach, describe, expect, it } from "vitest";
import type { PlayerEntityView } from "../visuals/view.js";
import { playerFacesLeft } from "./playerFacing.js";
import { resetViewOrientation, setViewOrientation } from "../../view/transform/viewState.js";

afterEach(resetViewOrientation);

describe("player sprite facing", () => {
  it("uses canonical view facing while idle, rather than weapon-orbit state", () => {
    expect(playerFacesLeft(view({ attacking: false, weaponAimAngle: null, faceX: -1 }))).toBe(true);
    expect(playerFacesLeft(view({ attacking: false, weaponAimAngle: null, faceX: 1 }))).toBe(false);
  });

  it("faces an acquired assisted target during the attack pulse", () => {
    const targetLeft = view({ attacking: true, attackAngleRad: Math.PI });
    expect(playerFacesLeft(targetLeft)).toBe(true);
  });

  it("keeps unarmed idle facing on the canonical local direction", () => {
    const unarmedLeft = view({ assistedAim: false, weaponId: null, weaponAimAngle: null, faceX: -1 });
    const unarmedRight = view({ assistedAim: false, weaponId: null, weaponAimAngle: null, faceX: 1 });
    expect(playerFacesLeft(unarmedLeft)).toBe(true);
    expect(playerFacesLeft(unarmedRight)).toBe(false);
  });

  it("uses the captured attack aim for an unarmed local attack", () => {
    const unarmed = view({
      assistedAim: false,
      weaponId: null,
      attacking: true,
      attackAngleRad: Math.PI,
      faceX: 1,
    });
    expect(playerFacesLeft(unarmed)).toBe(true);
  });

  it("uses live local mouse aim while unarmed and idle", () => {
    const aimingLeft = view({ assistedAim: false, weaponId: null, attacking: false, weaponAimAngle: Math.PI, faceX: 1 });
    const aimingRight = view({ assistedAim: false, weaponId: null, attacking: false, weaponAimAngle: 0, faceX: -1 });
    expect(playerFacesLeft(aimingLeft)).toBe(true);
    expect(playerFacesLeft(aimingRight)).toBe(false);
  });

  it("projects replicated remote facing into the current view orientation", () => {
    setViewOrientation(90);
    const remoteFacingNorth = view({ weaponAimAngle: null, faceX: 0, faceY: -1 });
    expect(playerFacesLeft(remoteFacingNorth)).toBe(true);
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
