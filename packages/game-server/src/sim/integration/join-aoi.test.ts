import {
  AOI_RADIUS,
  MOVE_SPEED,
  PLAYER_MAX_HP,
  RECONNECT_GRACE_MS,
  RUN_SPEED_MULTIPLIER,
  TICK_RATE,
  personalRoomFeatures,
  safeRoomFeatures,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { GameSim } from "../index.js";
import { snapToFloor } from "../testzone.js";
import { findSafeRoomDoor, input, makeSim, stepN, teleport } from "./support.js";

/**
 * Epic 2 regressions: join/spawn, debug harness, AOI replication, and
 * reconnect — ported from reference/game-server/sim.test.ts.
 */

describe("GameSim: join, spawn, and AOI", () => {
  let sim: GameSim;

  beforeEach(() => {
    sim = makeSim();
  });

  it("keeps the sandbox level enemy-free and clustered near the shared anchor", () => {
    const sandbox = makeSim(77, {});
    const player = sandbox.addPlayer("Sandboxer", "sandbox-client");
    stepN(sandbox, TICK_RATE * 3);
    const tileX = Math.floor(player.spawn.x);
    const tileY = Math.floor(player.spawn.y);
    expect(sandbox.world.isWalkable(tileX, tileY)).toBe(true);
    // Sandbox no longer has a hand-authored fixed layout (v1's
    // heightAt(18,57)===7 no longer means anything under the BSP
    // generator) — instead assert the invariant that still holds: the
    // proving-ground anchor clusters players near a fixed point.
    expect(Math.hypot(player.spawn.x - 28.5, player.spawn.y - 28.5)).toBeLessThan(10);
    expect(sandbox.enemyCount).toBe(0); // testFixtures off here too: no random spawns either
  });

  it("debug teleport and god mode work when enabled — and are dropped when not", () => {
    const a = sim.addPlayer("A", "client-a");
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const spawnX = aEntity.body.x;
    sim.queueAction(a.playerId, { type: "debug", op: "teleport", x: 500.5, y: 500.5 });
    sim.step();
    expect(aEntity.body.x).toBeCloseTo(spawnX, 3);

    const dev = makeSim(99, { debugCommands: true, testFixtures: true });
    const b = dev.addPlayer("B", "client-b");
    const bEntity = dev.getPlayerEntity(b.playerId)!;
    dev.queueAction(b.playerId, { type: "debug", op: "teleport", x: 10.5, y: 30.5 });
    dev.step();
    expect(bEntity.body.x).toBeCloseTo(10.5, 3);
    expect(bEntity.body.y).toBeCloseTo(30.5, 3);

    dev.queueAction(b.playerId, { type: "debug", op: "god", on: true });
    dev.step();
    dev.spawnEnemy("skeleton", bEntity.body.x + 1, bEntity.body.y);
    for (let i = 0; i < TICK_RATE * 4; i++) dev.step();
    expect(bEntity.hp).toBe(PLAYER_MAX_HP); // it swung plenty; god shrugged
    expect(bEntity.body.kx).toBe(0); // and no knockback sticks
  });

  it("reseeds canonical dev pickups after another player consumes them", () => {
    const player = sim.addPlayer("Fixture user", "fixture-client");
    const entity = sim.getPlayerEntity(player.playerId)!;
    const bandageSpot = snapToFloor(sim, 26.5, 28.5); // testzone.ts's canonical bandage fixture
    teleport(entity, bandageSpot.x, bandageSpot.y, sim);
    sim.step();
    sim.queueAction(player.playerId, { type: "pickup" });
    sim.step();
    expect(sim.getInventory(player.playerId)!.some((stack) => stack.item === "bandage")).toBe(true);

    const snapshots = stepN(sim, TICK_RATE * 2);
    expect(
      snapshots.get(player.playerId)!.entities.some((entry) => entry.kind === "item" && entry.defId === "bandage"),
    ).toBe(true);
  });

  it("clusters consecutive sandbox joins near the shared anchor, 2 tiles apart", () => {
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");
    // The BSP generator may nudge the second candidate off the exact
    // offset tile onto the nearest real floor — assert the clustering
    // intent (tight, non-zero spacing), not the v1-exact distance.
    const distance = Math.hypot(a.spawn.x - b.spawn.x, a.spawn.y - b.spawn.y);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(8);
  });

  it("replicates only within AOI, with enter/leave notices", () => {
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");
    teleport(sim.getPlayerEntity(b.playerId)!, a.spawn.x + AOI_RADIUS * 3, a.spawn.y, sim);
    let snap = sim.step().get(a.playerId)!;
    expect(snap.entities.filter((e) => e.kind === "player")).toHaveLength(0);

    teleport(sim.getPlayerEntity(b.playerId)!, a.spawn.x + 3, a.spawn.y, sim);
    snap = sim.step().get(a.playerId)!;
    expect(snap.entities.some((e) => e.id === b.playerId)).toBe(true);

    teleport(sim.getPlayerEntity(b.playerId)!, a.spawn.x + AOI_RADIUS * 3, a.spawn.y, sim);
    snap = sim.step().get(a.playerId)!;
    expect(snap.left).toContain(b.playerId);
  });

  it("resumes with a fresh input sequence and full area sync", () => {
    const a = sim.addPlayer("A", "client-a");
    sim.handleInput(a.playerId, input(500, 1, 0));
    sim.step();
    sim.markDisconnected(a.playerId);
    sim.step();
    const resumed = sim.addPlayer("A", "client-a", a.resumeToken);
    expect(resumed.resumed).toBe(true);
    sim.handleInput(a.playerId, input(1, 1, 0));
    const snap = sim.step().get(a.playerId)!;
    expect(snap.lastSeq).toBe(1);
  });

  it("immediately hides and freezes a disconnected player during reconnect grace", () => {
    const observer = sim.addPlayer("Observer", "client-observer");
    const leaving = sim.addPlayer("Leaving", "client-leaving");
    const entity = sim.getPlayerEntity(leaving.playerId)!;
    teleport(entity, observer.spawn.x + 3, observer.spawn.y, sim);
    expect(sim.step().get(observer.playerId)!.entities.some((e) => e.id === leaving.playerId)).toBe(true);

    sim.handleInput(leaving.playerId, input(1, 1, 0));
    sim.markDisconnected(leaving.playerId);
    const x = entity.body.x;
    const snapshot = sim.step().get(observer.playerId)!;

    expect(snapshot.entities.some((e) => e.id === leaving.playerId)).toBe(false);
    expect(snapshot.left).toContain(leaving.playerId);
    expect(entity.body.x).toBe(x);
    expect(sim.playerCount).toBe(2);

    const resumed = sim.addPlayer("Leaving", "client-leaving", leaving.resumeToken);
    expect(resumed.resumed).toBe(true);
  });

  it("holding run is server-authoritative: RUN_SPEED_MULTIPLIER faster than walking, per tick (Epic 7.12)", () => {
    // A short 5-tick run (< 3 tiles at RUN_SPEED_MULTIPLIER) from a claimed-open
    // fixture spot — plenty of clearance from the proving ground's geometry.
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    const claimed = new Set<string>();
    const start = snapToFloor(sim, 5, 5, claimed);
    teleport(entity, start.x, start.y, sim);

    for (let seq = 1; seq <= 5; seq++) {
      sim.handleInput(a.playerId, { type: "input", seq, moveX: 1, moveY: 0, jump: false, run: true });
      sim.step();
    }
    const ranDistance = entity.body.x - start.x;
    expect(ranDistance).toBeCloseTo(MOVE_SPEED * RUN_SPEED_MULTIPLIER * (5 / TICK_RATE), 2);

    const b = sim.addPlayer("B", "client-b");
    const walker = sim.getPlayerEntity(b.playerId)!;
    const walkStart = snapToFloor(sim, 5, 12, claimed);
    teleport(walker, walkStart.x, walkStart.y, sim);
    for (let seq = 1; seq <= 5; seq++) {
      sim.handleInput(b.playerId, input(seq, 1, 0));
      sim.step();
    }
    expect(walker.body.x - walkStart.x).toBeLessThan(ranDistance);
  });

  it("replicates player movement facing to nearby observers", () => {
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");
    sim.handleInput(b.playerId, input(1, 1, -1));
    const remote = sim.step().get(a.playerId)!.entities.find((entry) => entry.id === b.playerId);
    expect(remote?.faceX).toBeCloseTo(Math.SQRT1_2, 5);
    expect(remote?.faceY).toBeCloseTo(-Math.SQRT1_2, 5);
  });

  it("reconnect mid-safe-room-nesting resumes the same door-return stack (Epic 7.12)", () => {
    const a = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(a.playerId)!;
    const door = findSafeRoomDoor(sim);
    const floorX = door.x + 0.5;
    const floorY = door.y + 0.5;
    teleport(entity, floorX, floorY, sim);
    sim.queueAction(a.playerId, { type: "interact" }); // floor -> safe room
    sim.step();

    const safeF = safeRoomFeatures(door.doorCx, door.doorCy);
    teleport(entity, safeF.doorPersonal.x + 0.5, safeF.doorPersonal.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "interact" }); // safe room -> personal room
    sim.step();
    const personalX = entity.body.x;
    const personalY = entity.body.y;

    // Disconnect and resume mid-nesting (personal room, two doors deep) — the
    // in-memory PlayerSlot (and its returnStack) survives as long as the grace
    // window hasn't elapsed, per join.ts's tryResume.
    sim.markDisconnected(a.playerId);
    const resumed = sim.addPlayer("A", "client-a", a.resumeToken);
    expect(resumed.resumed).toBe(true);
    expect(entity.body.x).toBeCloseTo(personalX, 3);
    expect(entity.body.y).toBeCloseTo(personalY, 3);

    // First exit unwinds to the safe room (not straight to the floor) — proof
    // the two-deep returnStack itself, not just position, survived resume.
    const features = personalRoomFeatures(0);
    teleport(entity, features.exit.x + 0.5, features.exit.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();
    expect(entity.body.x).toBeCloseTo(safeF.doorPersonal.x + 0.5, 3);

    teleport(entity, safeF.exit.x + 0.5, safeF.exit.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();
    expect(entity.body.x).toBeCloseTo(floorX, 3);
    expect(entity.body.y).toBeCloseTo(floorY, 3);
  });

  it("a resume token is useless with a different clientId (no identity theft)", () => {
    const a = sim.addPlayer("A", "client-a");
    sim.markDisconnected(a.playerId);
    const thief = sim.addPlayer("A", "client-evil", a.resumeToken);
    expect(thief.resumed).toBe(false);
    expect(thief.playerId).not.toBe(a.playerId);
  });

  it("reaps disconnected players after the grace window, dropping their loot", () => {
    const a = sim.addPlayer("A", "client-a");
    sim.getInventory(a.playerId)![0] = { item: "knife", qty: 1 };
    sim.markDisconnected(a.playerId);
    stepN(sim, Math.ceil((RECONNECT_GRACE_MS / 1000) * TICK_RATE) + 2);
    expect(sim.playerCount).toBe(0);
    // Their inventory hit the floor — lootable, per full-loot rules.
    const b = sim.addPlayer("B", "client-b");
    const snap = sim.step().get(b.playerId)!;
    expect(snap.entities.some((e) => e.kind === "item" && e.defId === "knife")).toBe(true);
  });
});
