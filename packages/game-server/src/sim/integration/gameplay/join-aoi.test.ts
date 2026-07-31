/** Covers joining, spawn placement, AOI visibility, and replicated movement semantics. */
import {
  AOI_RADIUS,
  MOVE_SPEED,
  PLAYER_MAX_HP,
  RUN_SPEED_MULTIPLIER,
  TICK_RATE,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { GameSim } from "../../core/index.js";
import { snapToFloor } from "../../core/testzone.js";
import { input, makeSim, stepN, teleport } from "../support.js";

describe("GameSim: join, spawn, and AOI", () => {
  let sim: GameSim;

  beforeEach(() => {
    sim = makeSim();
  });

  it("keeps the sandbox free of random hostiles while seeding its training dummy", () => {
    const sandbox = makeSim(77, {});
    const player = sandbox.addPlayer({ name: "Sandboxer", clientId: "sandbox-client" });
    stepN(sandbox, TICK_RATE * 3);
    const tileX = Math.floor(player.spawn.x);
    const tileY = Math.floor(player.spawn.y);
    expect(sandbox.world.isWalkable(tileX, tileY)).toBe(true);
    expect(Math.hypot(player.spawn.x - 28.5, player.spawn.y - 28.5)).toBeLessThan(10);
    expect(sandbox.enemyCount).toBe(1);
  });

  it("debug teleport and god mode work when enabled and are dropped when not", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const spawnX = aEntity.body.x;
    sim.queueAction(a.playerId, { type: "debug", op: "teleport", x: 500.5, y: 500.5 });
    sim.step();
    expect(aEntity.body.x).toBeCloseTo(spawnX, 3);

    const dev = makeSim(99, { debugCommands: true, testFixtures: true });
    const b = dev.addPlayer({ name: "B", clientId: "client-b" });
    const bEntity = dev.getPlayerEntity(b.playerId)!;
    const debugTarget = snapToFloor({ sim: dev, x: 10.5, y: 30.5 });
    dev.queueAction(b.playerId, { type: "debug", op: "teleport", ...debugTarget });
    dev.step();
    expect(bEntity.body.x).toBeCloseTo(debugTarget.x, 3);
    expect(bEntity.body.y).toBeCloseTo(debugTarget.y, 3);
    dev.queueAction(b.playerId, { type: "debug", op: "god", on: true });
    dev.step();
    dev.spawnEnemy("skeleton", bEntity.body.x + 1, bEntity.body.y);
    for (let index = 0; index < TICK_RATE * 4; index += 1) dev.step();
    expect(bEntity.hp).toBe(PLAYER_MAX_HP);
    expect(bEntity.body.kx).toBe(0);

    dev.queueAction(b.playerId, { type: "debug", op: "god" });
    const toggleOff = dev.step().get(b.playerId);
    expect(toggleOff?.events).toContainEqual({ t: "toast", msg: "God mode off" });
  });

  it("reseeds canonical dev pickups after another player consumes them", () => {
    const player = sim.addPlayer({ name: "Fixture user", clientId: "fixture-client" });
    const entity = sim.getPlayerEntity(player.playerId)!;
    const bandageSpot = snapToFloor({ sim, x: 26.5, y: 28.5 });
    teleport({ entity: entity, x: bandageSpot.x, y: bandageSpot.y, sim: sim });
    sim.step();
    sim.queueAction(player.playerId, { type: "pickup" });
    sim.step();
    expect(sim.getInventory(player.playerId)!.some((stack) => stack.item === "bandage")).toBe(true);
    const snapshots = stepN(sim, TICK_RATE * 2);
    expect(snapshots.get(player.playerId)!.entities.some((entry) => entry.kind === "item" && entry.defId === "bandage")).toBe(true);
  });

  it("clusters consecutive sandbox joins near the shared anchor", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const b = sim.addPlayer({ name: "B", clientId: "client-b" });
    const distance = Math.hypot(a.spawn.x - b.spawn.x, a.spawn.y - b.spawn.y);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(8);
  });

  it("replicates only within AOI, with enter and leave notices", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const b = sim.addPlayer({ name: "B", clientId: "client-b" });
    teleport({ entity: sim.getPlayerEntity(b.playerId)!, x: a.spawn.x + AOI_RADIUS * 3, y: a.spawn.y, sim: sim });
    let snap = sim.step().get(a.playerId)!;
    expect(snap.entities.filter((e) => e.kind === "player")).toHaveLength(0);
    teleport({ entity: sim.getPlayerEntity(b.playerId)!, x: a.spawn.x + 3, y: a.spawn.y, sim: sim });
    snap = sim.step().get(a.playerId)!;
    expect(snap.entities.some((e) => e.id === b.playerId)).toBe(true);
    teleport({ entity: sim.getPlayerEntity(b.playerId)!, x: a.spawn.x + AOI_RADIUS * 3, y: a.spawn.y, sim: sim });
    snap = sim.step().get(a.playerId)!;
    expect(snap.left).toContain(b.playerId);
  });

  it("holds run server-authoritatively faster than walking", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const entity = sim.getPlayerEntity(a.playerId)!;
    const claimed = new Set<string>();
    const start = snapToFloor({ sim, x: 5, y: 5, claimed });
    teleport({ entity: entity, x: start.x, y: start.y, sim: sim });
    for (let seq = 1; seq <= 5; seq += 1) {
      sim.handleInput(a.playerId, { type: "input", seq, projectedServerTick: sim.tick, moveX: 1, moveY: 0, jump: false, run: true });
      sim.step();
    }
    const ranDistance = entity.body.x - start.x;
    expect(ranDistance).toBeCloseTo(MOVE_SPEED * RUN_SPEED_MULTIPLIER * (5 / TICK_RATE), 2);
    const b = sim.addPlayer({ name: "B", clientId: "client-b" });
    const walker = sim.getPlayerEntity(b.playerId)!;
    const walkStart = snapToFloor({ sim, x: 5, y: 12, claimed });
    teleport({ entity: walker, x: walkStart.x, y: walkStart.y, sim: sim });
    for (let seq = 1; seq <= 5; seq += 1) {
      sim.handleInput(b.playerId, input({ seq: seq, moveX: 1, moveY: 0 }));
      sim.step();
    }
    expect(walker.body.x - walkStart.x).toBeLessThan(ranDistance);
  });

  it("replicates player movement facing to nearby observers", () => {
    const a = sim.addPlayer({ name: "A", clientId: "client-a" });
    const b = sim.addPlayer({ name: "B", clientId: "client-b" });
    sim.handleInput(b.playerId, input({ seq: 1, moveX: 1, moveY: -1 }));
    const remote = sim.step().get(a.playerId)!.entities.find((entry) => entry.id === b.playerId);
    expect(remote?.faceX).toBeCloseTo(Math.SQRT1_2, 5);
    expect(remote?.faceY).toBeCloseTo(-Math.SQRT1_2, 5);
  });
});
