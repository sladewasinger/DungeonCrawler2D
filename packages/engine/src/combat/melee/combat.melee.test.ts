import { describe, expect, it } from "vitest";
import { makeEntity, type Entity } from "../../entities/entity.js";
import { createBody } from "../../entities/movement/index.js";
import { isWithinFacingArc, pickMeleeTarget } from "./melee.js";

function enemyAt(distance: number, offAxisDegrees: number): Entity {
  const radians = (offAxisDegrees * Math.PI) / 180;
  return makeEntity("enemy", createBody(distance * Math.cos(radians), distance * Math.sin(radians), 0), { hp: 20, maxHp: 20 });
}

function targetAt(distance: number, offAxisDegrees: number) {
  const attacker = makeEntity("player", createBody(0, 0, 0), { hp: 20, maxHp: 20 });
  return { attacker, enemy: enemyAt(distance, offAxisDegrees) };
}

function meleeTarget({ attacker, enemy, range, arcCos }: { attacker: Entity; enemy: Entity; range?: number; arcCos?: number }) {
  const input = { attacker, direction: { x: 1, y: 0 }, candidates: [enemy], isPartyMember: () => false };
  if (range === undefined || arcCos === undefined) return pickMeleeTarget(input);
  return pickMeleeTarget({ ...input, range, arcCos });
}

describe("melee cone-vs-body (point-blank playability)", () => {
  it("hits a touching enemy 60 degrees off the aim axis", () => {
    const { attacker, enemy } = targetAt(0.5, 60);
    expect(meleeTarget({ attacker, enemy })).toBe(enemy);
  });

  it("still misses a ranged enemy 60 degrees off-axis", () => {
    const { attacker, enemy } = targetAt(1.5, 60);
    expect(meleeTarget({ attacker, enemy })).toBeNull();
  });

  it("hits a ranged enemy inside the plain 45-degree half-arc", () => {
    const { attacker, enemy } = targetAt(1.5, 40);
    expect(meleeTarget({ attacker, enemy })).toBe(enemy);
  });

  it("range reaches the target's near edge, not its center", () => {
    const { attacker, enemy } = targetAt(1.75, 0);
    expect(meleeTarget({ attacker, enemy })).toBe(enemy);
  });

  it("dist 2.0 dead-ahead is still out of reach", () => {
    const { attacker, enemy } = targetAt(2, 0);
    expect(meleeTarget({ attacker, enemy })).toBeNull();
  });

  it("supports distinct synthetic reach and arc overrides", () => {
    const distant = targetAt(2.2, 0);
    expect(meleeTarget({ ...distant, range: 2, arcCos: 0.7071 })).toBe(distant.enemy);
    expect(meleeTarget({ ...distant, range: 1.6, arcCos: 0.8 })).toBeNull();
    const offAxis = targetAt(1.5, 50);
    expect(meleeTarget({ ...offAxis, range: 2, arcCos: 0.7071 })).toBe(offAxis.enemy);
    expect(meleeTarget({ ...offAxis, range: 1.6, arcCos: 0.8 })).toBeNull();
  });
});

describe("directional guard arc", () => {
  const facing = { x: 1, y: 0 };
  it("covers the forward half-angle and leaves the rear exposed", () => {
    expect(isWithinFacingArc({ facing, target: { x: 1, y: 0 } })).toBe(true);
    expect(isWithinFacingArc({ facing, target: { x: 1, y: 1 } })).toBe(true);
    expect(isWithinFacingArc({ facing, target: { x: 0, y: 1 } })).toBe(false);
    expect(isWithinFacingArc({ facing, target: { x: -1, y: 0 } })).toBe(false);
  });
});
