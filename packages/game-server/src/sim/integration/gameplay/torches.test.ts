import {
  MAX_ACTIVE_TORCHES_PER_FLOOR,
  TORCH_BURN_TICKS,
  type EntitySnapshot,
  type ServerSnapshot,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { GameSim } from "../../core/index.js";
import { findFlatArena, makeSim, stepN, teleport } from "../support.js";

/**
 * Epic 7.8 (server lane): starter kit grant + the throwTorch intent's
 * flight/landing/burnout lifecycle, replicated as its own AOI entity kind.
 */

function torchesIn(snaps: Map<string, ServerSnapshot>, playerId: string): EntitySnapshot[] {
  return (snaps.get(playerId)?.entities ?? []).filter((e) => e.kind === "torch");
}

describe("GameSim: throwTorch", () => {
  let sim: GameSim;

  beforeEach(() => {
    sim = makeSim();
  });

  it("consumes one torch per throw and rejects the intent once none remain", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const entity = sim.getPlayerEntity(a.playerId)!;
    const arena = findFlatArena({ sim: sim, anchor: { x: entity.body.x, y: entity.body.y }, clearance: 4 });
    teleport({ entity: entity, x: arena.x, y: arena.y, sim: sim });
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

  it("flies a ballistic arc, lands as a placed light source, and schedules its burn-out", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const entity = sim.getPlayerEntity(a.playerId)!;
    const arena = findFlatArena({ sim: sim, anchor: { x: entity.body.x, y: entity.body.y }, clearance: 4 });
    teleport({ entity: entity, x: arena.x, y: arena.y, sim: sim });

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
    expect(expiresAtTick).toBeDefined();
    const landingTick = expiresAtTick! - TORCH_BURN_TICKS;
    expect(landingTick).toBeGreaterThan(0);
    expect(landingTick).toBeLessThanOrEqual(sim.tick);
    expect(landedId).toBeDefined();
  });

  it("removes a placed torch when its burn-out deadline passes", () => {
    sim = makeSim(1234, { testFixtures: true, torchBurnTicks: 40 });
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const entity = sim.getPlayerEntity(a.playerId)!;
    const arena = findFlatArena({ sim: sim, anchor: { x: entity.body.x, y: entity.body.y }, clearance: 4 });
    teleport({ entity: entity, x: arena.x, y: arena.y, sim: sim });

    sim.queueAction(a.playerId, { type: "throwTorch", dirX: 1, dirY: 0 });
    let snaps = stepN(sim, 30);
    const torch = torchesIn(snaps, a.playerId).find((candidate) => candidate.state === "placed");
    expect(torch).toBeDefined();
    const ticksUntilExpiry = torch!.expiresAtTick! - sim.tick;
    snaps = stepN(sim, ticksUntilExpiry - 1);
    expect(torchesIn(snaps, a.playerId)).toContainEqual(expect.objectContaining({ id: torch!.id }));
    snaps = stepN(sim, 2);
    expect(torchesIn(snaps, a.playerId)).not.toContainEqual(expect.objectContaining({ id: torch!.id }));
  });

  it("picks up a still-burning placed torch as one full inventory torch", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const entity = sim.getPlayerEntity(a.playerId)!;
    const arena = findFlatArena({ sim: sim, anchor: { x: entity.body.x, y: entity.body.y }, clearance: 4 });
    teleport({ entity: entity, x: arena.x, y: arena.y, sim: sim });

    sim.queueAction(a.playerId, { type: "throwTorch", dirX: 1, dirY: 0 });
    const snaps = stepN(sim, 30);
    const torch = torchesIn(snaps, a.playerId).find((candidate) => candidate.state === "placed");
    expect(torch).toBeDefined();
    teleport({ entity: entity, x: torch!.x, y: torch!.y, sim: sim });
    sim.queueAction(a.playerId, { type: "pickup" });
    const afterPickup = sim.step();

    expect(sim.getInventory(a.playerId)?.find((stack) => stack.item === "torch")?.qty).toBe(3);
    expect(torchesIn(afterPickup, a.playerId).some((candidate) => candidate.id === torch!.id)).toBe(false);
  });

  it("reserves the floor torch budget before consuming inventory", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const inventory = sim.getInventory(a.playerId)!;
    inventory.find((stack) => stack.item === "torch")!.qty = MAX_ACTIVE_TORCHES_PER_FLOOR + 1;
    let snapshots = new Map<string, ServerSnapshot>();
    for (let i = 0; i < MAX_ACTIVE_TORCHES_PER_FLOOR + 1; i++) {
      sim.queueAction(a.playerId, { type: "throwTorch", dirX: 1, dirY: 0 });
      snapshots = sim.step();
    }

    expect(torchesIn(snapshots, a.playerId)).toHaveLength(MAX_ACTIVE_TORCHES_PER_FLOOR);
    expect(inventory.find((stack) => stack.item === "torch")?.qty).toBe(1);
    expect(snapshots.get(a.playerId)?.events).toContainEqual({
      t: "toast",
      msg: "too many torches burning nearby",
    });
  });
});
