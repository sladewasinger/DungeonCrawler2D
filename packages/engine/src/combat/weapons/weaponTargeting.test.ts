import { describe, expect, it } from "vitest";
import { makeEntity } from "../../entities/entity.js";
import { createBody } from "../../entities/movement/state.js";
import { resolveWeaponProfile } from "./weaponProfiles.js";
import { knockbackForWeapon, selectWeaponTargets } from "./weaponTargeting.js";

function combatant(input: {
  kind: "player" | "enemy";
  id: string;
  x: number;
  y?: number;
  combatHurtbox?: { halfWidth: number; halfDepth: number };
}) {
  return makeEntity(input.kind, createBody(input.x, input.y ?? 0, 0), {
    id: input.id,
    hp: 10,
    maxHp: 10,
    ...(input.combatHurtbox ? { combatHurtbox: input.combatHurtbox } : {}),
  });
}

describe("shape-specific attack targeting", () => {
  it("hits every non-party hostile in a cone while protecting party members", () => {
    const attacker = combatant({ kind: "player", id: "attacker", x: 0 });
    const partyMember = combatant({ kind: "player", id: "party", x: 0.5 });
    const firstEnemy = combatant({ kind: "enemy", id: "first", x: 1 });
    const secondEnemy = combatant({ kind: "enemy", id: "second", x: 1.5 });
    const sword = resolveWeaponProfile({
      weapon: { damage: 9, range: 2.4, cooldownMs: 350, arcCos: 0.7071, knockbackForce: 10 },
    });

    const targets = selectWeaponTargets({
      attacker,
      direction: { x: 1, y: 0 },
      candidates: [partyMember, firstEnemy, secondEnemy],
      isPartyMember: (target) => target.id === partyMember.id,
      profile: sword,
    });

    expect(targets.map((target) => target.id)).toEqual(["first", "second"]);
  });

  it("falls back to only the closest party member when a cone has no hostiles", () => {
    const attacker = combatant({ kind: "player", id: "attacker", x: 0 });
    const nearestPartyMember = combatant({ kind: "player", id: "near", x: 0.5 });
    const fartherPartyMember = combatant({ kind: "player", id: "far", x: 1 });
    const sword = resolveWeaponProfile({
      weapon: { damage: 9, range: 2.4, cooldownMs: 350, arcCos: 0.7071, knockbackForce: 10 },
    });

    const targets = selectWeaponTargets({
      attacker,
      direction: { x: 1, y: 0 },
      candidates: [fartherPartyMember, nearestPartyMember],
      isPartyMember: () => true,
      profile: sword,
    });

    expect(targets.map((target) => target.id)).toEqual(["near"]);
  });

  it("selects every living target in a hammer ground radius", () => {
    const attacker = combatant({ kind: "player", id: "attacker", x: 0 });
    const near = combatant({ kind: "enemy", id: "near", x: 1.5 });
    const edge = combatant({ kind: "enemy", id: "edge", x: 2 });
    const far = combatant({ kind: "enemy", id: "far", x: 2.3 });
    const hammer = resolveWeaponProfile({
      weapon: { damage: 7, range: 1.7, cooldownMs: 500, shape: "ground", knockbackForce: 18 },
    });
    const targets = selectWeaponTargets({
      attacker,
      direction: { x: 1, y: 0 },
      candidates: [attacker, near, edge, far],
      isPartyMember: () => false,
      profile: hammer,
    });
    expect(targets.map((target) => target.id)).toEqual(["near", "edge"]);
  });

  it("returns the authored high-knockback vector away from the attacker", () => {
    const attacker = combatant({ kind: "player", id: "attacker", x: 0, y: 0 });
    const target = combatant({ kind: "enemy", id: "target", x: 1, y: 1 });
    const hammer = resolveWeaponProfile({
      weapon: { damage: 7, range: 1.7, cooldownMs: 500, shape: "ground", knockbackForce: 18 },
    });
    expect(knockbackForWeapon(attacker, target, hammer)).toEqual({
      dirX: 1,
      dirY: 1,
      force: 18,
    });
  });

  it("selects an off-center large target only when its box intersects the cone", () => {
    const attacker = combatant({ kind: "player", id: "attacker", x: 0 });
    const target = combatant({
      kind: "enemy",
      id: "large",
      x: 1.6,
      y: 1.7,
      combatHurtbox: { halfWidth: 0.8, halfDepth: 0.8 },
    });
    const sword = resolveWeaponProfile({
      weapon: { damage: 9, range: 2.4, cooldownMs: 350, arcCos: 0.7071 },
    });

    const targets = selectWeaponTargets({
      attacker,
      direction: { x: 1, y: 0 },
      candidates: [target],
      isPartyMember: () => false,
      profile: sword,
    });
    expect(targets).toEqual([target]);
  });
});
