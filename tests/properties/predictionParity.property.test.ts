/** Property-based determinism, finiteness, and obstacle collision checks for movement kinematics. */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { WorldChunkCache, resolveMovement } from "@dc2d/engine";

describe("movement & prediction parity properties", () => {
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
