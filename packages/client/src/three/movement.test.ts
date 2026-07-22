import { describe, expect, it } from "vitest";
import { stepFirstPerson, type FirstPersonWorld } from "./movement.js";

const world = (heightAt: (x: number, z: number) => number, walkable = () => true): FirstPersonWorld => ({
  isWalkable: walkable,
  groundAt: heightAt,
});

describe("stepFirstPerson", () => {
  it("moves along the camera's forward direction", () => {
    const result = stepFirstPerson(
      { x: 0.5, y: 0, z: 0.5, verticalVelocity: 0, grounded: true },
      { forward: 1, right: 0, jump: false, yaw: 0 },
      world(() => 0),
      0.1,
    );

    expect(result.z).toBeLessThan(0.5);
  });

  it("does not climb terrain higher than the step limit", () => {
    const result = stepFirstPerson(
      { x: 0.5, y: 0, z: 0.5, verticalVelocity: 0, grounded: true },
      { forward: 1, right: 0, jump: false, yaw: 0 },
      world((_x, z) => (z < 0.5 ? 2 : 0)),
      0.1,
    );

    expect(result.z).toBe(0.5);
  });

  it("does not automatically climb a one-tile ledge", () => {
    const result = stepFirstPerson(
      { x: 0.5, y: 0, z: 0.5, verticalVelocity: 0, grounded: true },
      { forward: 1, right: 0, jump: false, yaw: 0 },
      world((_x, z) => (z < 0.5 ? 1 : 0)),
      0.1,
    );

    expect(result.z).toBe(0.5);
  });

  it("steps onto a half-tile ledge", () => {
    const result = stepFirstPerson(
      { x: 0.5, y: 0, z: 0.5, verticalVelocity: 0, grounded: true },
      { forward: 1, right: 0, jump: false, yaw: 0 },
      world((_x, z) => (z < 0.5 ? 0.5 : 0)),
      0.1,
    );

    expect(result.z).toBeLessThan(0.5);
  });

  it("jumps and then falls back to the floor", () => {
    const airborne = stepFirstPerson(
      { x: 0.5, y: 0, z: 0.5, verticalVelocity: 0, grounded: true },
      { forward: 0, right: 0, jump: true, yaw: 0 },
      world(() => 0),
      0.1,
    );
    let landed = { ...airborne, verticalVelocity: -3, grounded: false };
    for (let step = 0; step < 8; step += 1) {
      landed = stepFirstPerson(landed, { forward: 0, right: 0, jump: false, yaw: 0 }, world(() => 0), 0.05);
    }

    expect(airborne.y).toBeGreaterThan(0);
    expect(landed).toMatchObject({ y: 0, verticalVelocity: 0, grounded: true });
  });
});
