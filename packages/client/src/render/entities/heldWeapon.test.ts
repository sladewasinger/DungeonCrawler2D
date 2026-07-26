import type Phaser from "phaser";
import { describe, expect, it } from "vitest";
import {
  BLOCK_GUARD_TILT_RAD,
  BLOCK_GUARD_TINT,
} from "./blockGuard.js";
import { updateHeldWeapon, type HeldWeaponPose } from "./heldWeapon.js";

function weaponProbe() {
  return {
    visible: false,
    frame: "",
    tint: 0,
    x: 0,
    y: 0,
    rotation: 0,
    scale: 0,
    flipY: false,
    setVisible(value: boolean) { this.visible = value; return this; },
    setFrame(value: string) { this.frame = value; return this; },
    setTint(value: number) { this.tint = value; return this; },
    clearTint() { this.tint = 0; return this; },
    setScale(value: number) { this.scale = value; return this; },
    setDepth() { return this; },
    setFlipX() { return this; },
    setFlipY(value: boolean) { this.flipY = value; return this; },
    setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
    setRotation(value: number) { this.rotation = value; return this; },
    setAngle() { return this; },
  };
}

const BLOCKING_POSE: HeldWeaponPose = {
  screenX: 100,
  screenY: 80,
  facingX: 1,
  striking: false,
  blocking: true,
  nowMs: 0,
  strikeProgress: 0,
  wielderDepth: 10,
  orbitAngleRad: 0,
  attackAngleRad: 0,
  isFistFallback: false,
};

describe("updateHeldWeapon blocking", () => {
  it("puts a knife in the animated tinted guard pose", () => {
    const probe = weaponProbe();
    updateHeldWeapon(
      probe as unknown as Phaser.GameObjects.Sprite,
      "weapon_knife",
      BLOCKING_POSE,
    );
    expect(probe.visible).toBe(true);
    expect(probe.frame).toBe("weapon_knife");
    expect(probe.tint).toBe(BLOCK_GUARD_TINT);
    expect(probe.x).toBeGreaterThan(BLOCKING_POSE.screenX);
    expect(probe.rotation).toBeCloseTo(BLOCK_GUARD_TILT_RAD);
    expect(probe.scale).toBeGreaterThan(0);
  });

  it("keeps a left-side guard blade upright", () => {
    const probe = weaponProbe();
    updateHeldWeapon(
      probe as unknown as Phaser.GameObjects.Sprite,
      "weapon_sword",
      { ...BLOCKING_POSE, orbitAngleRad: Math.PI },
    );
    expect(probe.flipY).toBe(true);
  });

  it("shows the unarmed atlas particle with a skin-tone tint", () => {
    const probe = weaponProbe();
    updateHeldWeapon(
      probe as unknown as Phaser.GameObjects.Sprite,
      "particle_soft",
      {
        ...BLOCKING_POSE,
        blocking: false,
        isFistFallback: true,
        orbitAngleRad: Math.PI / 2,
      },
    );
    expect(probe.visible).toBe(true);
    expect(probe.frame).toBe("particle_soft");
    expect(probe.tint).toBe(0xd9a066);
  });
});
