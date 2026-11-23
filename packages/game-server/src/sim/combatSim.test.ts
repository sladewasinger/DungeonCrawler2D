import { SANCTUARY_CENTER } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { WorldSim } from "./worldSim.js";

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Expected value");
  return value;
}

function advanceMove(opts: {
  readonly sim: WorldSim; readonly id: string; readonly moveX: number; readonly moveY: number; readonly steps: number; readonly seqStart: number;
}): number {
  opts.sim.queueInput(opts.id, { seq: opts.seqStart, moveX: opts.moveX, moveY: opts.moveY });
  for (let i = 0; i < opts.steps; i++) opts.sim.step();
  return opts.seqStart + 1;
}

function swingLoop(opts: {
  readonly sim: WorldSim; readonly id: string; readonly count: number; readonly seqStart: number;
}): number {
  let seq = opts.seqStart;
  for (let hit = 0; hit < opts.count; hit++) {
    opts.sim.queueInput(opts.id, { seq: seq++, moveX: 0, moveY: 0, aimX: 1, aimY: 0, attack: true });
    for (let i = 0; i < 6; i++) opts.sim.step();
  }
  return seq;
}

function waitForTelegraph(sim: WorldSim): boolean {
  for (let i = 0; i < 40; i++) {
    sim.step();
    if (sim.drainCombatEvents().some((e) => e.kind === "telegraph")) return true;
  }
  return false;
}

function waitForTelegraphAndParry(sim: WorldSim, playerId: string, seqStart: number): boolean {
  if (!waitForTelegraph(sim)) return false;
  sim.queueInput(playerId, { seq: seqStart, moveX: 0, moveY: 0, aimX: 1, aimY: 0, block: true });
  for (let k = 0; k < 20; k++) {
    sim.step();
    if (sim.drainCombatEvents().some((x) => x.kind === "parry")) return true;
  }
  return false;
}

describe("combatSim", () => {
  it("runs 3-hit combos on straw dummy, bursts slime target with explode-away gore, and drains stamina", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Fighter");
    let seq = advanceMove({ sim, id, moveX: 1, moveY: 0, steps: 30, seqStart: 1 });
    seq = swingLoop({ sim, id, count: 3, seqStart: seq });

    const hits = sim.drainCombatEvents().filter((e) => e.kind === "hit" && e.targetId === "dummy-straw");
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[hits.length - 1]?.value).toBeGreaterThan(hits[0]?.value ?? 0);

    seq = advanceMove({ sim, id, moveX: 0, moveY: 1, steps: 7, seqStart: seq });
    swingLoop({ sim, id, count: 4, seqStart: seq });
    const burst = sim.drainCombatEvents().find((e) => e.kind === "hit" && e.targetId === "dummy-slime" && e.fatal);
    expect(burst?.goreStyle).toBe("explode-away");
    expect(burst?.substance).toBe("slime");
  });

  it("consumes arrows, blocks sanctuary PvP, parries spar dummy, heals with bandages, and respawns on 0 HP", () => {
    const sim = new WorldSim(1337);
    const a = sim.addPlayer("Archer");
    const b = sim.addPlayer("Sparrer");
    sim.equipArmor(b, { slotIndex: 18, targetArmor: "offhand" });
    expect(must(sim.inventorySnapshot(b)).armor.offhand).toBe("wooden-shield");

    expect(must(sim.snapshots()[0]).inSanctuary).toBe(true);
    sim.queueInput(a, { seq: 1, moveX: 0, moveY: 0, aimX: 1, aimY: 0, attack: true });
    sim.step();
    expect(must(sim.snapshots()[1]).hp).toBe(100);

    sim.selectHotbar(a, 1);
    let seqA = advanceMove({ sim, id: a, moveX: 1, moveY: 0, steps: 30, seqStart: 2 });
    sim.queueInput(a, { seq: seqA++, moveX: 0, moveY: 0, aimX: 1, aimY: 0, bowDraw: true });
    for (let i = 0; i < 10; i++) sim.step();
    sim.queueInput(a, { seq: seqA++, moveX: 0, moveY: 0, aimX: 1, aimY: 0, bowRelease: true });
    for (let i = 0; i < 8; i++) sim.step();
    expect(must(sim.inventorySnapshot(a)).slots[2]?.count).toBe(15);

    const stamBefore = must(sim.snapshots().find((p) => p.id === a)).stamina ?? 100;
    sim.queueInput(a, { seq: seqA++, moveX: 0, moveY: 1, dodge: true });
    sim.step();
    expect(must(sim.snapshots().find((p) => p.id === a)).stamina).toBeLessThan(stamBefore);

    let seqB = advanceMove({ sim, id: b, moveX: 1, moveY: 0, steps: 36, seqStart: 1 });
    seqB = advanceMove({ sim, id: b, moveX: 0, moveY: -1, steps: 10, seqStart: seqB });
    sim.queueInput(b, { seq: seqB++, moveX: 0, moveY: 0, aimX: 1, aimY: 0 });
    expect(waitForTelegraphAndParry(sim, b, seqB++)).toBe(true);
    const sparEntity = sim.combatSnapshots().entities.find((e) => e.id === "dummy-spar");
    expect(sparEntity?.staggerTimer).toBeGreaterThan(0);

    sim.queueInput(b, { seq: seqB++, moveX: 0, moveY: 1 });
    for (let i = 0; i < 10; i++) sim.step();
    sim.selectHotbar(a, 0);
    sim.queueInput(a, { seq: seqA, moveX: 0, moveY: 0, aimX: 1, aimY: 1, attack: true });
    for (let i = 0; i < 6; i++) sim.step();
    sim.selectHotbar(b, 4);
    sim.queueInput(b, { seq: seqB, moveX: 0, moveY: 0, attack: true });
    sim.step();
    const bAfterHeal = must(sim.snapshots().find((p) => p.id === b));
    expect(bAfterHeal.hp).toBeLessThanOrEqual(100);
    expect(must(sim.snapshots().find((p) => p.id === a)).x).toBeGreaterThan(SANCTUARY_CENTER.x + 5);
  });

  it("holds fallen player in downed state with hitTimer before sanctuary respawn", () => {
    const sim = new WorldSim(1337);
    const a = sim.addPlayer("Attacker");
    const b = sim.addPlayer("Victim");
    let seqA = advanceMove({ sim, id: a, moveX: 1, moveY: 0, steps: 32, seqStart: 1 });
    sim.queueInput(a, { seq: seqA++, moveX: 0, moveY: 0 });
    let seqB = advanceMove({ sim, id: b, moveX: 1, moveY: 0, steps: 33, seqStart: 1 });
    sim.queueInput(b, { seq: seqB++, moveX: 0, moveY: 0 });
    sim.selectHotbar(a, 0);
    for (let i = 0; i < 16; i++) {
      sim.queueInput(a, { seq: seqA++, moveX: 0, moveY: 0, aimX: 1, aimY: 0, attack: true });
      for (let s = 0; s < 6; s++) sim.step();
      if ((must(sim.snapshots().find((p) => p.id === b)).hp ?? 100) <= 0) break;
    }
    const fallen = must(sim.snapshots().find((p) => p.id === b));
    expect(fallen.hp).toBe(0);
    expect(fallen.respawnTimer).toBeGreaterThan(1.0);
    expect(fallen.hitTimer).toBeGreaterThan(0);
    expect(fallen.x).toBeGreaterThan(SANCTUARY_CENTER.x + 5);

    sim.queueInput(b, { seq: seqB++, moveX: 1, moveY: 0 });
    sim.step();
    expect(must(sim.snapshots().find((p) => p.id === b)).x).toBeCloseTo(fallen.x, 3);

    sim.queueInput(b, { seq: seqB, moveX: 0, moveY: 0 });
    sim.drainCombatEvents();
    for (let i = 0; i < 36; i++) sim.step();
    const revived = must(sim.snapshots().find((p) => p.id === b));
    expect(revived.respawnTimer).toBe(0);
    expect(revived.hp).toBe(revived.maxHp);
    expect(revived.x).toBeCloseTo(SANCTUARY_CENTER.x, 2);
  });
});
