import {
  TORCH_BURN_TICKS,
  type EntitySnapshot,
  type ServerSnapshot,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { ACTIVE_FIRE_TORCH_BURN_TICKS } from "../../combat/configuration/torchLifecycleTuning.js";
import { GameSim } from "../../core/index.js";
import { findFlatArena, makeSim, stepN, teleport } from "../support.js";

function torchesIn(snaps: Map<string, ServerSnapshot>, playerId: string): EntitySnapshot[] {
  return (snaps.get(playerId)?.entities ?? []).filter((e) => e.kind === "torch");
}

function placedTorch(
  snaps: Map<string, ServerSnapshot>,
  playerId: string,
  torchId: string,
): EntitySnapshot | undefined {
  return torchesIn(snaps, playerId).find((torch) => torch.id === torchId);
}

function prepareThrow(sim: GameSim): { playerId: string; x: number; y: number } {
  const player = sim.addPlayer({ name: "A", clientId: "client-a" });
  const entity = sim.getPlayerEntity(player.playerId)!;
  const arena = findFlatArena({
    sim,
    anchor: { x: entity.body.x, y: entity.body.y },
    clearance: 4,
  });
  teleport({ entity, x: arena.x, y: arena.y, sim });
  return { playerId: player.playerId, x: entity.body.x, y: entity.body.y };
}

interface ThrowTarget {
  sim: GameSim;
  playerId: string;
  x: number;
  y: number;
}

function throwTo({ sim, playerId, x, y }: ThrowTarget): EntitySnapshot {
  sim.queueAction(playerId, { type: "useSlot", slot: 0, targetX: x, targetY: y });
  const snapshots = stepN(sim, 30);
  const torch = torchesIn(snapshots, playerId)
    .find((candidate) => candidate.state === "placed");
  expect(torch).toBeDefined();
  return torch!;
}

describe("GameSim: target-based torch landing", () => {
  it("preserves an off-center ground target and placed state", () => {
    const sim = makeSim();
    const start = prepareThrow(sim);
    const targetX = start.x + 2.25;
    const targetY = start.y + 0.25;
    const torch = throwTo({ sim, playerId: start.playerId, x: targetX, y: targetY });

    expect(torch.x).toBeCloseTo(targetX, 8);
    expect(torch.y).toBeCloseTo(targetY, 8);
    expect(torch.x).not.toBeCloseTo(Math.floor(targetX) + 0.5, 2);
    expect(torch.state).toBe("placed");
  });

  it("does not create fire when a torch lands on bare floor", () => {
    const sim = makeSim();
    const start = prepareThrow(sim);
    const targetX = start.x + 2.25;
    const targetY = start.y + 0.25;
    const target = sim.addPlayer({ name: "B", clientId: "client-b" });
    const targetEntity = sim.getPlayerEntity(target.playerId)!;
    teleport({ entity: targetEntity, x: targetX, y: targetY, sim });
    sim.endSpawnGrace(target.playerId);
    const hpBefore = targetEntity.hp;
    throwTo({ sim, playerId: start.playerId, x: targetX, y: targetY });

    expect(sim.areas.defAt(Math.floor(targetX), Math.floor(targetY))).not.toBe("area-fire");
    expect(targetEntity.hp).toBe(hpBefore);
    expect(targetEntity.statuses).toHaveLength(0);
  });

  it("ignites an oiled combatant in flight and still becomes a placed torch", () => {
    const sim = makeSim();
    const start = prepareThrow(sim);
    const target = sim.addPlayer({ name: "B", clientId: "client-b" });
    const targetEntity = sim.getPlayerEntity(target.playerId)!;
    const targetX = start.x + 2.25;
    const targetY = start.y + 0.25;
    teleport({ entity: targetEntity, x: targetX, y: targetY, sim });
    sim.endSpawnGrace(target.playerId);
    sim.effects.applyStatus({ entity: targetEntity, statusId: "oiled", events: [] });

    const torch = throwTo({ sim, playerId: start.playerId, x: targetX, y: targetY });

    expect(targetEntity.statuses).toContainEqual(expect.objectContaining({
      defId: "on-fire",
      sourceId: start.playerId,
    }));
    expect(targetEntity.statuses.some((status) => status.defId === "oiled")).toBe(false);
    expect(torch.state).toBe("placed");
    expect(sim.areas.defAt(Math.floor(targetX), Math.floor(targetY))).not.toBe("area-fire");
  });

  it("burns out on the configured deadline when its landing oil ignites", () => {
    const sim = makeSim();
    const start = prepareThrow(sim);
    const targetX = start.x + 2.25;
    const targetY = start.y + 0.25;
    const x = Math.floor(targetX);
    const y = Math.floor(targetY);
    sim.areas.spawn({ defId: "area-oil", x, y, radius: 0 });

    const torch = throwTo({ sim, playerId: start.playerId, x: targetX, y: targetY });
    const expiresAtTick = torch.expiresAtTick!;

    expect(sim.areas.hasTagAt(x, y, "fire")).toBe(true);
    expect(expiresAtTick - ACTIVE_FIRE_TORCH_BURN_TICKS).toBeGreaterThan(0);
    expect(expiresAtTick - ACTIVE_FIRE_TORCH_BURN_TICKS).toBeLessThanOrEqual(sim.tick);
    expect(ACTIVE_FIRE_TORCH_BURN_TICKS).toBeLessThan(TORCH_BURN_TICKS);

    const beforeBurnout = stepN(sim, expiresAtTick - sim.tick - 1);
    expect(torchesIn(beforeBurnout, start.playerId)).toContainEqual(
      expect.objectContaining({ id: torch.id }),
    );
    const atBurnout = stepN(sim, 1);
    expect(torchesIn(atBurnout, start.playerId)).not.toContainEqual(
      expect.objectContaining({ id: torch.id }),
    );
  });

  it("only shortens an already placed torch once active fire reaches it", () => {
    const sim = makeSim();
    const start = prepareThrow(sim);
    const torch = throwTo({
      sim,
      playerId: start.playerId,
      x: start.x + 2.25,
      y: start.y + 0.25,
    });
    sim.areas.spawn({
      defId: "area-fire",
      x: Math.floor(torch.x),
      y: Math.floor(torch.y),
      radius: 0,
    });

    const firstTick = stepN(sim, 1);
    const first = placedTorch(firstTick, start.playerId, torch.id);
    expect(first?.expiresAtTick).toBe(sim.tick + ACTIVE_FIRE_TORCH_BURN_TICKS);

    const laterTick = stepN(sim, 3);
    const later = placedTorch(laterTick, start.playerId, torch.id);
    expect(later?.expiresAtTick).toBe(first?.expiresAtTick);
  });
});
