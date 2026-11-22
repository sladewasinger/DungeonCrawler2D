import { describe, expect, it } from "vitest";
import { CHARACTER_WORLD_SCALE, resolveFacingDir } from "./characterTypes.js";
import { computeHeldLayout } from "./heldPlacement.js";

describe("resolveFacingDir", () => {
  it("maps aim vectors to south, north, east, and west mirrored side facings", () => {
    expect(resolveFacingDir(0, 1)).toEqual({ dir: "south", flipX: false });
    expect(resolveFacingDir(0, -1)).toEqual({ dir: "north", flipX: false });
    expect(resolveFacingDir(1, 0)).toEqual({ dir: "side", flipX: false });
    expect(resolveFacingDir(-1, 0)).toEqual({ dir: "side", flipX: true });
    expect(resolveFacingDir(0, 0)).toEqual({ dir: "south", flipX: false });
  });
});

describe("computeHeldLayout", () => {
  it("keeps sword in dominant right hand and torch in left hand across south mouse sweeps", () => {
    const southLeft = computeHeldLayout({
      aimX: -0.2, aimY: 1, heldItem: "sword", torchLit: true, twoHanded: false, aimMode: "meleeCarry", timeSec: 0, moving: false,
    });
    const southRight = computeHeldLayout({
      aimX: 0.2, aimY: 1, heldItem: "sword", torchLit: true, twoHanded: false, aimMode: "meleeCarry", timeSec: 0, moving: false,
    });
    expect(southLeft.main.x).toBeLessThan(0);
    expect(southRight.main.x).toBeLessThan(0);
    expect(southLeft.offhand.x).toBeGreaterThan(0);
    expect(southRight.offhand.x).toBeGreaterThan(0);
    expect(southLeft.main.behindBody).toBe(false);
    expect(southLeft.offhand.behindBody).toBe(false);
  });

  it("flips dominant right/left hand positions cleanly when facing north, east, and west", () => {
    const north = computeHeldLayout({
      aimX: 0, aimY: -1, heldItem: "sword", torchLit: true, twoHanded: false, aimMode: "meleeCarry", timeSec: 0, moving: false,
    });
    expect(north.main.x).toBeGreaterThan(0);
    expect(north.main.behindBody).toBe(true);
    expect(north.offhand.x).toBeLessThan(0);
    expect(north.offhand.behindBody).toBe(true);

    const east = computeHeldLayout({
      aimX: 1, aimY: 0, heldItem: "sword", torchLit: true, twoHanded: false, aimMode: "meleeCarry", timeSec: 0, moving: false,
    });
    expect(east.main.behindBody).toBe(false);
    expect(east.offhand.x).toBeGreaterThan(5);
    expect(east.offhand.behindBody).toBe(true);

    const west = computeHeldLayout({
      aimX: -1, aimY: 0, heldItem: "sword", torchLit: true, twoHanded: false, aimMode: "meleeCarry", timeSec: 0, moving: false,
    });
    expect(west.offhand.behindBody).toBe(false);
    expect(west.main.x).toBeLessThan(-4);
    expect(west.main.behindBody).toBe(true);
  });

  it("aims bow 360 degrees with left-hip waist lantern and suppresses duplicate held torch", () => {
    const bowWest = computeHeldLayout({
      aimX: -1, aimY: 0.1, heldItem: "bow", torchLit: true, twoHanded: true, aimMode: "aim360", timeSec: 0, moving: false,
    });
    expect(bowWest.offhand.kind).toBe("lantern");
    expect(bowWest.offhand.x).toBeLessThan(0);
    expect(bowWest.offhand.behindBody).toBe(false);
    expect(bowWest.main.scaleY).toBe(-CHARACTER_WORLD_SCALE);

    const heldTorch = computeHeldLayout({
      aimX: 1, aimY: 0, heldItem: "torch", torchLit: true, twoHanded: false, aimMode: "upright", timeSec: 0, moving: false,
    });
    expect(heldTorch.offhand.kind).toBe("none");
    expect(heldTorch.main.x).toBeGreaterThan(0);
  });
});
