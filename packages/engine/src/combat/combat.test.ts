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

describe("melee cone-vs-body (point-blank playability)", () => {
  // Hand-derived cases (BODY_RADIUS 0.25, MELEE_ARC_COS 0.7071 -> half-arc 45deg,
  // MELEE_RANGE 1.6). Allowance = asin(0.25/dist); hit iff offAxis <= 45 + allowance.
  //
  //  dist  offAxis  allowance  verdict
  //  0.5   60deg    30.0deg    HIT  (45+30=75 >= 60) — the user's "swing goes past a
  //                                  close enemy": center-point testing rejected this
  //  1.5   60deg    9.6deg     MISS (45+9.6=54.6 < 60) — arc stays honest at range
  //  1.5   40deg    9.6deg     HIT  (inside the plain 45deg arc, as before)
  //  1.75  0deg     —          HIT  (1.75 - 0.25 = 1.5 <= 1.6: blade reaches the EDGE)
  //  2.0   0deg     —          MISS (2.0 - 0.25 = 1.75 > 1.6)
  const attacker = combatant("player", 0, 0);
  const aimEast = { x: 1, y: 0 };

  function enemyAt(dist: number, offAxisDeg: number): Entity {
    const rad = (offAxisDeg * Math.PI) / 180;
    return combatant("enemy", dist * Math.cos(rad), dist * Math.sin(rad));
  }

  it("hits a touching enemy 60 degrees off the aim axis (dist 0.5)", () => {
    const enemy = enemyAt(0.5, 60);
    expect(pickMeleeTarget(attacker, aimEast.x, aimEast.y, [enemy], () => false)).toBe(enemy);
  });

  it("still misses a RANGED enemy 60 degrees off-axis (dist 1.5) — the arc does not balloon", () => {
    const enemy = enemyAt(1.5, 60);
    expect(pickMeleeTarget(attacker, aimEast.x, aimEast.y, [enemy], () => false)).toBeNull();
  });

  it("hits a ranged enemy inside the plain 45-degree half-arc (dist 1.5, 40 degrees)", () => {
    const enemy = enemyAt(1.5, 40);
    expect(pickMeleeTarget(attacker, aimEast.x, aimEast.y, [enemy], () => false)).toBe(enemy);
  });

  it("range reaches the target's near edge, not its center (dist 1.75 dead-ahead hits)", () => {
    const enemy = enemyAt(1.75, 0);
    expect(pickMeleeTarget(attacker, aimEast.x, aimEast.y, [enemy], () => false)).toBe(enemy);
  });

  it("dist 2.0 dead-ahead is still out of reach", () => {
    const enemy = enemyAt(2.0, 0);
    expect(pickMeleeTarget(attacker, aimEast.x, aimEast.y, [enemy], () => false)).toBeNull();
  });
});
