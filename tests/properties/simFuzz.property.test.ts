/** Property-based SimScenario fuzzing verifying crash-free finite state invariants. */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SimScenario } from "../../packages/game-server/src/testing/simScenario.js";

const stepArb = fc.record({
  moveX: fc.double({ min: -1, max: 1, noNaN: true }),
  moveY: fc.double({ min: -1, max: 1, noNaN: true }),
  aimX: fc.double({ min: -1, max: 1, noNaN: true }),
  aimY: fc.double({ min: -1, max: 1, noNaN: true }),
  attack: fc.boolean(),
  dodge: fc.boolean(),
  block: fc.boolean(),
  crouch: fc.boolean(),
  jump: fc.boolean(),
  hotbar: fc.integer({ min: 0, max: 8 }),
});

describe("SimScenario fuzz properties [sim]", () => {
  it("maintains finite coordinates, valid vitals, and zero uncaught errors under random inputs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9999 }),
        fc.array(stepArb, { minLength: 5, maxLength: 25 }),
        (seed, frames) => {
          const sc = SimScenario.create({ seed });
          try {
            const hero = sc.joinPlayer({ name: "FuzzHero" });
            for (const f of frames) {
              sc.sendAction(hero.id, { t: "selectHotbar", slot: f.hotbar });
              sc.sendInput(hero.id, {
                moveX: f.moveX, moveY: f.moveY, aimX: f.aimX, aimY: f.aimY,
                attack: f.attack, dodge: f.dodge, block: f.block, crouch: f.crouch, jump: f.jump,
              });
              sc.tick(2);
            }
            const p = sc.getPlayer(hero.id)!;
            expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
            expect(Number.isFinite(p.combat.hp) && p.combat.hp >= 0 && p.combat.hp <= p.combat.maxHp).toBe(true);
            expect(Number.isFinite(p.combat.stamina) && p.combat.stamina >= 0).toBe(true);
          } finally {
            sc.dispose();
          }
        },
      ),
      { numRuns: 20, seed: 20261126 },
    );
  });
});
