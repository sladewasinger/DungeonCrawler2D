// Epic 6 unit tests: melee targeting aid + enemy AI decisions.
import { describe, expect, it } from "vitest";
import { Rng } from "../core/rng.js";
import type { EnemyDef } from "../effects/types.js";
import { makeEntity, type Entity } from "../entities/entity.js";
import { createBody } from "../entities/movement/index.js";
import { enemyThink, newBrain } from "./ai.js";
import { pickMeleeTarget } from "./melee.js";

function combatant(kind: "player" | "enemy", x: number, y: number, partyId?: string): Entity {
  const e = makeEntity(kind, createBody(x, y, 0), { hp: 20, maxHp: 20 });
  if (partyId) e.partyId = partyId;
  return e;
}

// Faithful to packages/content/src/data/enemies.json — kept local so combat
// tests don't depend on a full content-registry build.
const slimeDef: EnemyDef = {
  id: "slime",
  name: "Slime",
  tags: ["organic", "slime"],
  hp: 12,
  speed: 3,
  aggroRadius: 8,
  attack: { damage: 2, range: 0.9, cooldown: 1.2 },
  immunities: ["bleed"],
  drops: [{ item: "rag", chance: 0.4 }],
  sprite: "slime",
};

const spitterDef: EnemyDef = {
  id: "spitter",
  name: "Spitter",
  tags: ["organic"],
  hp: 14,
  speed: 3.5,
  aggroRadius: 10,
  attack: {
    damage: 3,
    range: 7,
    cooldown: 2,
    ranged: true,
    applies: [{ status: "poisoned", chance: 0.5 }],
  },
  drops: [
    { item: "water-flask", chance: 0.3 },
    { item: "raw-meat", chance: 0.5 },
  ],
  sprite: "spitter",
};

describe("melee targeting aid", () => {
  it("prefers a hostile over a closer party member in the same arc", () => {
    const attacker = combatant("player", 0, 0, "party1");
    const friend = combatant("player", 0.6, 0, "party1");
    const enemy = combatant("enemy", 1.3, 0);
    const target = pickMeleeTarget(attacker, 1, 0, [friend, enemy], (t) => t.partyId === "party1");
    expect(target).toBe(enemy);
  });

  it("hits the party member when no hostile is in the arc — friendly fire is real", () => {
    const attacker = combatant("player", 0, 0, "party1");
    const friend = combatant("player", 1, 0, "party1");
    const target = pickMeleeTarget(attacker, 1, 0, [friend], (t) => t.partyId === "party1");
    expect(target).toBe(friend);
  });

  it("respects range, arc, and vertical reach", () => {
    const attacker = combatant("player", 0, 0);
    const behind = combatant("enemy", -1, 0);
    const far = combatant("enemy", 5, 0);
    const above = combatant("enemy", 1, 0);
    above.body.z = 3; // on a ledge overhead
    expect(pickMeleeTarget(attacker, 1, 0, [behind, far, above], () => false)).toBeNull();
  });

  it("never targets items or the dead", () => {
    const attacker = combatant("player", 0, 0);
    const corpse = combatant("enemy", 1, 0);
    corpse.hp = 0;
    const loot = makeEntity("item", createBody(1, 0, 0), { defId: "knife" });
    expect(pickMeleeTarget(attacker, 1, 0, [corpse, loot], () => false)).toBeNull();
  });
});

describe("enemy AI", () => {
  it("wanders without a target, chases when a player is in aggro range", () => {
    const rng = new Rng(5);
    const brain = newBrain();
    const slime = combatant("enemy", 0, 0);
    const farPlayer = combatant("player", 100, 100);
    const wander = enemyThink(brain, slime, slimeDef, [farPlayer], () => false, 0.05, () => rng.next());
    expect(wander.strike).toBeUndefined();

    const nearPlayer = combatant("player", 5, 0);
    const chase = enemyThink(brain, slime, slimeDef, [nearPlayer], () => false, 0.05, () => rng.next());
    expect(chase.move.moveX).toBe(1);
    expect(brain.targetId).toBe(nearPlayer.id);
  });

  it("strikes in range, then honors the cooldown", () => {
    const rng = new Rng(5);
    const brain = newBrain();
    const slime = combatant("enemy", 0, 0);
    const player = combatant("player", 0.5, 0);
    const first = enemyThink(brain, slime, slimeDef, [player], () => false, 0.05, () => rng.next());
    expect(first.strike?.targetId).toBe(player.id);
    const second = enemyThink(brain, slime, slimeDef, [player], () => false, 0.05, () => rng.next());
    expect(second.strike).toBeUndefined(); // cooling down
  });

  it("ignores players inside sanctuary — safe rooms are safe", () => {
    const rng = new Rng(5);
    const brain = newBrain();
    const slime = combatant("enemy", 0, 0);
    const shopper = combatant("player", 2, 0);
    const decision = enemyThink(brain, slime, slimeDef, [shopper], () => true, 0.05, () => rng.next());
    expect(brain.targetId).toBeNull();
    expect(decision.strike).toBeUndefined();
  });

  it("spitters shoot from range instead of closing in", () => {
    const rng = new Rng(5);
    const brain = newBrain();
    const spitter = combatant("enemy", 0, 0);
    const player = combatant("player", 5, 0);
    const decision = enemyThink(brain, spitter, spitterDef, [player], () => false, 0.05, () => rng.next());
    expect(decision.shoot?.targetId).toBe(player.id);
  });

  it("ignores downed players (they're out of the fight)", () => {
    const rng = new Rng(5);
    const brain = newBrain();
    const slime = combatant("enemy", 0, 0);
    const downed = combatant("player", 2, 0);
    downed.downedUntil = 9999;
    enemyThink(brain, slime, slimeDef, [downed], () => false, 0.05, () => rng.next());
    expect(brain.targetId).toBeNull();
  });

  it("ignores dead players", () => {
    const rng = new Rng(5);
    const brain = newBrain();
    const slime = combatant("enemy", 0, 0);
    const dead = combatant("player", 2, 0);
    dead.hp = 0;
    enemyThink(brain, slime, slimeDef, [dead], () => false, 0.05, () => rng.next());
    expect(brain.targetId).toBeNull();
  });
});
