import { LEVEL, World, type EntitySnapshot, type ServerSnapshot } from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { GameSim } from "../index.js";
import { content, SEED, findFlatArena, makeSim, stepN, teleport } from "./support.js";

/**
 * Epic 7.8 (server lane): starter kit grant + the throwTorch intent's
 * flight/landing/burnout lifecycle, replicated as its own AOI entity kind.
 */

function torchesIn(snaps: Map<string, ServerSnapshot>, playerId: string): EntitySnapshot[] {
  return (snaps.get(playerId)?.entities ?? []).filter((e) => e.kind === "torch");
}

describe("GameSim: starter kit", () => {
  it("grants sword, torches, and bandages on first join and after a kit-less restart", () => {
    const store = new PlayerStore(null);
    const sim1 = new GameSim(new World(SEED, 1, LEVEL.Sandbox), content, store, 1234, { testFixtures: true });
    const a = sim1.addPlayer("A", "client-a");
    const inv1 = sim1.getInventory(a.playerId)!;
    expect(inv1.find((s) => s.item === "sword")?.qty).toBe(1);
    expect(inv1.find((s) => s.item === "torch")?.qty).toBe(3);
    expect(inv1.find((s) => s.item === "bandage")?.qty).toBe(2);
    expect(sim1.getWeapon(a.playerId)).toBe("sword"); // first-weapon auto-equip

    // Simulate a server restart: a fresh GameSim sharing the durable
    // store, but with no in-memory slot or resume token to reattach to.
    // The kit lived only in memory (never stashed), so this returning
    // clientId is genuinely kit-less again — ensureStarterKit re-grants
    // it exactly like a brand-new join would (Epic 7.13 starter-kit
    // famine fix, ASSUMPTION #87, supersedes #2's "never re-granted").
    const sim2 = new GameSim(new World(SEED, 1, LEVEL.Sandbox), content, store, 99, { testFixtures: true });
    const again = sim2.addPlayer("A", "client-a");
    const inv2 = sim2.getInventory(again.playerId)!;
    expect(inv2.find((s) => s.item === "sword")?.qty).toBe(1);
    expect(inv2.find((s) => s.item === "torch")?.qty).toBe(3);
    expect(inv2.find((s) => s.item === "bandage")?.qty).toBe(2);
    expect(sim2.getWeapon(again.playerId)).toBe("sword");
  });

  it("does not re-grant the kit across an in-process reconnect (same resume token)", () => {
    const sim = makeSim();
    const a = sim.addPlayer("A", "client-a");
    const inv = sim.getInventory(a.playerId)!;
    inv.length = 0; // spend the starter kit down to nothing
    sim.markDisconnected(a.playerId);
    const resumed = sim.addPlayer("A", "client-a", a.resumeToken);
    expect(resumed.resumed).toBe(true);
    expect(sim.getInventory(a.playerId)).toEqual([]); // not refilled
  });
});

describe("GameSim: throwTorch", () => {
  let sim: GameSim;

  beforeEach(() => {
    sim = makeSim();
  });

  it("consumes one torch per throw and rejects the intent once none remain", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    const arena = findFlatArena(sim, entity.body.x, entity.body.y, 4);
    teleport(entity, arena.x, arena.y, sim);
    const inv = sim.getInventory(a.playerId)!;
    expect(inv.find((s) => s.item === "torch")?.qty).toBe(3);

    sim.queueAction(a.playerId, { type: "throwTorch", dirX: 1, dirY: 0 });
    let snaps = sim.step();
    expect(inv.find((s) => s.item === "torch")?.qty).toBe(2);
    expect(torchesIn(snaps, a.playerId).length).toBe(1);

    sim.queueAction(a.playerId, { type: "throwTorch", dirX: 1, dirY: 0 });
    sim.step();
    sim.queueAction(a.playerId, { type: "throwTorch", dirX: 1, dirY: 0 });
    snaps = sim.step();
    expect(inv.find((s) => s.item === "torch")).toBeUndefined();
    const countAtEmpty = torchesIn(snaps, a.playerId).length;

    // No torch left: the intent is dropped outright, no new entity spawns.
    sim.queueAction(a.playerId, { type: "throwTorch", dirX: 1, dirY: 0 });
    snaps = sim.step();
    expect(torchesIn(snaps, a.playerId).length).toBe(countAtEmpty);
  });

  it("flies a ballistic arc, lands as a placed light source, and burns out after TORCH_BURN_TICKS", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    const arena = findFlatArena(sim, entity.body.x, entity.body.y, 4);
    teleport(entity, arena.x, arena.y, sim);

    sim.queueAction(a.playerId, { type: "throwTorch", dirX: 1, dirY: 0 });
    let snaps = sim.step();
    let torch = torchesIn(snaps, a.playerId)[0];
    expect(torch?.state).toBe("flying");
    expect(torch?.air).toBe(true);

    snaps = stepN(sim, 30); // flight + landing
    torch = torchesIn(snaps, a.playerId)[0];
    expect(torch?.state).toBe("placed");
    expect(torch?.air).toBeUndefined(); // planted: renders grounded, not mid-hop
    const landedId = torch?.id;
    const expiresAtTick = torch?.expiresAtTick;
    expect(expiresAtTick).toBeGreaterThan(sim.tick);

    // Landing tick isn't fixed (arc length varies with terrain), so step
    // relative to the actual expiry tick rather than a hardcoded offset.
    snaps = stepN(sim, expiresAtTick! - sim.tick - 1); // one tick shy of burnout
    expect(torchesIn(snaps, a.playerId).some((t) => t.id === landedId)).toBe(true); // still burning

    snaps = stepN(sim, 2); // crosses expiresAtTick
    expect(torchesIn(snaps, a.playerId).some((t) => t.id === landedId)).toBe(false); // burned out
  });
});
