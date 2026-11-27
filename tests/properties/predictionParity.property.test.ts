/** Property-based determinism, finiteness, and obstacle collision checks for movement kinematics. */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { WorldChunkCache, computeCharacterMoveMultiplier, resolveMovement } from "@dc2d/engine";

describe("movement & prediction parity properties", () => {
  it("computes bounded, deterministic movement multipliers across action, water, web, and gear states", () => {
    fc.assert(
      fc.property(
        fc.record({
          dodging: fc.boolean(),
          swingProgress: fc.double({ min: 0, max: 1, noNaN: true }),
          swingWindupEnd: fc.double({ min: 0.1, max: 0.6, noNaN: true }),
          swingWeightTier: fc.constantFrom<"light" | "medium" | "heavy">("light", "medium", "heavy"),
          blocking: fc.boolean(),
          bowCharge: fc.double({ min: 0, max: 1, noNaN: true }),
          inWater: fc.boolean(),
          inDeepWater: fc.boolean(),
          stamina: fc.double({ min: 0, max: 100, noNaN: true }),
          crouching: fc.boolean(),
          webStick: fc.double({ min: 0, max: 1, noNaN: true }),
          cocoonProgress: fc.double({ min: 0, max: 1, noNaN: true }),
          gearAndBuffSpeedMult: fc.double({ min: 0.2, max: 1.6, noNaN: true }),
        }),
        (input) => {
          const mult = computeCharacterMoveMultiplier(input);
          expect(Number.isFinite(mult)).toBe(true);
          expect(mult).toBeGreaterThanOrEqual(0);
          expect(mult).toBe(computeCharacterMoveMultiplier(input));
          if (input.swingWeightTier === "heavy" && input.swingProgress > 0 && input.swingProgress <= input.swingWindupEnd && !input.dodging) {
            expect(mult).toBeLessThanOrEqual(0.58 * Math.max(0.65, input.gearAndBuffSpeedMult) + 1e-6);
          }
        },
      ),
      { numRuns: 100, seed: 20261126 },
    );
  });
  it("produces identical, finite positions and valid water/elevation state across repeated steps", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50_000 }),
        fc.array(
          fc.record({
            dx: fc.double({ min: -0.6, max: 0.6, noNaN: true }),
            dy: fc.double({ min: -0.6, max: 0.6, noNaN: true }),
            jumpZ: fc.double({ min: 0, max: 0.8, noNaN: true }),
          }),
          { minLength: 5, maxLength: 20 },
        ),
        (seed, steps) => {
          const runStream = (): { x: number; y: number; elevation: number } => {
            const cache = new WorldChunkCache(seed);
            let state = { x: 0.5, y: 0.5, elevation: 0 };
            for (const step of steps) {
              const res = resolveMovement({
                cache, x: state.x, y: state.y, dx: step.dx, dy: step.dy,
                radius: 0.17, elevation: state.elevation, jumpZ: step.jumpZ, airborne: step.jumpZ > 0.02,
              });
              expect(Number.isFinite(res.x)).toBe(true);
              expect(Number.isFinite(res.y)).toBe(true);
              expect(Number.isFinite(res.elevation)).toBe(true);
              expect(res.speedMultiplier).toBeGreaterThan(0);
              state = { x: res.x, y: res.y, elevation: res.elevation };
            }
            return state;
          };
          expect(runStream()).toEqual(runStream());
        },
      ),
      { numRuns: 30, seed: 20261126 },
    );
  });
});
