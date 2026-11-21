import { describe, expect, it } from "vitest";
import { GRAVITY, JUMP_VELOCITY, STEP_UP } from "../../../core/constants.js";
import { transitionAt } from "../../../navigation/gridPathTransition.js";
import { stairRimBlocks } from "../../../navigation/stairTraversal.js";
import { TILE } from "../../core/types.js";
import { analyzeFloorMovement } from "../finiteFloorMovement.js";
import { createFloorBuffers, localIndex } from "../finiteFloorBuffers.js";
import { carveTestPlane, smallMovementBounds, testAttempt } from "./finiteFloorTopology.js";

describe("finite floor movement topology", () => {
  it("rejects a protected stair-rim edge exactly as runtime movement does", () => {
    const bounds = smallMovementBounds();
    const buffers = createFloorBuffers(bounds);
    carveTestPlane(buffers, bounds);
    const stairIndex = localIndex({ bounds, x: 1, y: 1 });
    const sideIndex = localIndex({ bounds, x: 0, y: 1 });
    buffers.features[stairIndex] = TILE.Stairs;
    buffers.height[0] = 2;
    buffers.height[1] = 2;
    buffers.height[2] = 2;
    buffers.height[3] = 0;
    buffers.height[4] = 1;
    buffers.height[5] = 0;
    buffers.height[6] = 0;
    buffers.height[7] = 0;
    buffers.height[8] = 0;
    buffers.protectedCells[stairIndex] = 1;
    buffers.protectedCells[sideIndex] = 1;
    const movement = analyzeFloorMovement(testAttempt(buffers), bounds);
    const from = { x: 0, y: 1 };
    const to = { x: 1, y: 1 };
    const limits = {
      maxJumpRise: (JUMP_VELOCITY ** 2) / (2 * GRAVITY),
      jumpThreshold: STEP_UP,
    };

    expect(stairRimBlocks({ world: movement.view, from, to })).toBe(true);
    expect(transitionAt({ world: movement.view, options: {}, limits, from, to })).toBeNull();
    expect(movement.edgeIsLegal(from, to)).toBe(false);
    expect(movement.failures).toContain("illegal movement edge 0,1->1,1");
  });
});
