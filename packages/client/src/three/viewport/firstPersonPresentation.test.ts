/** Covers smooth camera presentation of shared-engine player state. */
import { describe, expect, it } from "vitest";
import { presentFirstPerson } from "./firstPersonPresentation.js";

const state = { x: 0, y: 0, z: 0, verticalVelocity: 0, grounded: true };

describe("presentFirstPerson", () => {
  it("moves toward the predicted body without snapping the camera", () => {
    const next = presentFirstPerson(state, { ...state, x: 1 }, 0.02);
    expect(next.x).toBeGreaterThan(0);
    expect(next.x).toBeLessThan(1);
  });

  it("adopts the predicted vertical state", () => {
    expect(presentFirstPerson(state, { ...state, y: 1, verticalVelocity: 3, grounded: false }, 0.02)).toMatchObject({ verticalVelocity: 3, grounded: false });
  });
});
