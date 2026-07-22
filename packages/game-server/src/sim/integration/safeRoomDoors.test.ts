import { LEVEL, TILE, World, hashString, safeRoomFeatures } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { GameSim } from "../index.js";
import { PlayerStore } from "../../store.js";
import { content, SEED, eventsOf, findSafeRoomDoor, teleport } from "./support.js";

/**
 * Investigation (docs/ASSUMPTIONS.md #86): a solo player standing in a safe
 * room sees BOTH the personal and the party door, same as reference/engine/
 * world/features/rooms.ts's v1 layout — room geometry is per-chunk
 * deterministic (ENGINEERING_STANDARDS.md), so it can't vary by who's
 * looking at it. What v1 actually gates on party membership is the door's
 * *function* (reference/game-server/sim/actions.ts), not its presence: solo
 * players get a toast, not a teleport. This suite asserts that contract
 * across multiple world seeds.
 */

function bootSim(worldSeed: number): GameSim {
  return new GameSim(new World(worldSeed, 1, LEVEL.Sandbox), content, new PlayerStore(null), 1234, {
    testFixtures: true,
  });
}

describe("safe room party door: present for everyone, functional only in a party", () => {
  const seeds = [SEED, hashString("sim-test-world-2")];

  it.each(seeds)("worldSeed %i: the solid overworld kiosk door opens from its south threshold", (worldSeed) => {
    const sim = bootSim(worldSeed);
    const player = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(player.playerId)!;
    const door = findSafeRoomDoor(sim);
    expect(sim.world.isWalkable(door.x, door.y)).toBe(false);

    teleport(entity, door.x + 0.5, door.y + 1.5, sim);
    sim.queueAction(player.playerId, { type: "interact" });
    sim.step();

    expect(sim.world.isSanctuary(Math.floor(entity.body.x), Math.floor(entity.body.y))).toBe(true);
  });

  it.each(seeds)("worldSeed %i: solo player sees both doors but the party door only toasts", (worldSeed) => {
    const sim = bootSim(worldSeed);
    const a = sim.addPlayer("A", "client-a");
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const door = findSafeRoomDoor(sim);
    teleport(aEntity, door.x + 0.5, door.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "interact" });
    sim.step();

    const safeF = safeRoomFeatures(door.doorCx, door.doorCy);
    expect(sim.world.tileAt(safeF.doorPersonal.x, safeF.doorPersonal.y)).toBe(TILE.DoorPersonal);
    expect(sim.world.tileAt(safeF.doorParty.x, safeF.doorParty.y)).toBe(TILE.DoorParty);

    teleport(aEntity, safeF.doorParty.x + 0.5, safeF.doorParty.y + 0.5, sim);
    sim.queueAction(a.playerId, { type: "interact" });
    const snaps = sim.step();
    expect(eventsOf(snaps, a.playerId).some((e) => e.t === "toast" && e.msg === "You're not in a party")).toBe(
      true,
    );
    expect(aEntity.body.x).toBeCloseTo(safeF.doorParty.x + 0.5, 3);
    expect(aEntity.body.y).toBeCloseTo(safeF.doorParty.y + 0.5, 3);
  });

  it.each(seeds)("worldSeed %i: partied player's same door teleports into the shared party room", (worldSeed) => {
    const sim = bootSim(worldSeed);
    const a = sim.addPlayer("A", "client-a");
    const b = sim.addPlayer("B", "client-b");
    const aEntity = sim.getPlayerEntity(a.playerId)!;
    const door = findSafeRoomDoor(sim);
    const safeF = safeRoomFeatures(door.doorCx, door.doorCy);
    teleport(aEntity, safeF.doorParty.x + 0.5, safeF.doorParty.y + 0.5, sim);
    teleport(sim.getPlayerEntity(b.playerId)!, aEntity.body.x, aEntity.body.y, sim);

    sim.queueAction(a.playerId, { type: "party", op: "invite", target: b.playerId });
    sim.step();
    sim.queueAction(b.playerId, { type: "party", op: "accept" });
    sim.step();

    sim.queueAction(a.playerId, { type: "interact" });
    const snaps = sim.step();
    expect(eventsOf(snaps, a.playerId).some((e) => e.t === "toast" && e.msg === "The party room")).toBe(true);
    expect(sim.world.isSanctuary(Math.floor(aEntity.body.x), Math.floor(aEntity.body.y))).toBe(true);
  });
});
