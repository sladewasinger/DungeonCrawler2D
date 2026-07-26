/** Verifies disconnected players remain inert, visible, and safely resumable during grace. */
import {
  AOI_RADIUS,
  TICK_RATE,
  personalRoomFeatures,
  safeRoomFeatures,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { findSafeRoomDoor, input, makeSim, stepN, teleport } from "./support.js";

describe("GameSim reconnect grace", () => {
  it("accepts fresh input after a resume and sends a complete area snapshot", () => {
    const sim = makeSim();
    const player = sim.addPlayer("A", "client-a");
    sim.handleInput(player.playerId, input(500, 1, 0));
    sim.step();
    sim.markDisconnected(player.playerId);
    sim.step();
    expect(sim.addPlayer("A", "client-a", player.resumeToken).resumed).toBe(true);
    sim.handleInput(player.playerId, input(1, 1, 0));
    expect(sim.step().get(player.playerId)?.lastSeq).toBe(1);
  });

  it("keeps a disconnected player visible, inert, and resumable during grace", () => {
    const sim = makeSim();
    const observer = sim.addPlayer("Observer", "client-observer");
    const leaving = sim.addPlayer("Leaving", "client-leaving");
    const entity = sim.getPlayerEntity(leaving.playerId)!;
    teleport(entity, observer.spawn.x + 3, observer.spawn.y, sim);
    sim.getInventory(leaving.playerId)!.push({ item: "knife", qty: 1 });
    sim.getHotbar(leaving.playerId)![2] = "bandage";
    sim.queueAction(leaving.playerId, { type: "equip", item: "knife" });
    sim.step();
    sim.queueAction(observer.playerId, { type: "party", op: "invite", target: leaving.playerId });
    sim.step();
    sim.queueAction(leaving.playerId, { type: "party", op: "accept" });
    sim.step();
    entity.hp = 17;
    sim.handleInput(leaving.playerId, input(42, 1, 0));
    sim.markDisconnected(leaving.playerId);
    const { x, y } = entity.body;
    const snapshot = sim.step().get(observer.playerId)!;
    expect(snapshot.entities.find((entry) => entry.id === leaving.playerId)).toMatchObject({ disconnected: true, hp: 17 });
    expect(snapshot.left).not.toContain(leaving.playerId);
    expect(snapshot.party?.members).toContainEqual(expect.objectContaining({ id: leaving.playerId, disconnected: true }));
    stepN(sim, TICK_RATE * 31);
    expect(entity.body).toMatchObject({ x, y });
    teleport(sim.getPlayerEntity(observer.playerId)!, x + AOI_RADIUS * 3, y, sim);
    sim.areas.spawn("area-fire", Math.floor(x), Math.floor(y), 0);
    sim.spawnEnemy("slime", x + 1, y);
    stepN(sim, TICK_RATE);
    expect(entity).toMatchObject({ hp: 17, statuses: [] });
    const resumed = sim.addPlayer("Leaving", "client-leaving", leaving.resumeToken);
    expect(resumed).toMatchObject({ resumed: true, playerId: leaving.playerId });
    expect(resumed.spawn).toMatchObject({ x, y, z: entity.body.z });
    expect(sim.getInventory(leaving.playerId)).toContainEqual({ item: "knife", qty: 1 });
    expect(sim.getHotbar(leaving.playerId)?.[2]).toBe("bandage");
    expect(sim.getWeapon(leaving.playerId)).toBe("knife");
  });

  it("replays a pending party invite after the invited player reconnects", () => {
    const sim = makeSim();
    const inviter = sim.addPlayer("Inviter", "client-inviter");
    const invited = sim.addPlayer("Invited", "client-invited");
    teleport(sim.getPlayerEntity(invited.playerId)!, inviter.spawn.x + 2, inviter.spawn.y, sim);
    sim.queueAction(inviter.playerId, { type: "party", op: "invite", target: invited.playerId });
    expect(sim.step().get(invited.playerId)?.events.some((event) => event.t === "invite")).toBe(true);
    sim.markDisconnected(invited.playerId);
    expect(sim.addPlayer("Invited", "client-invited", invited.resumeToken)).toMatchObject({ playerId: invited.playerId, resumed: true });
    expect(sim.step().get(invited.playerId)?.events.some((event) => event.t === "invite" && event.from === inviter.playerId)).toBe(true);
  });

  it("resumes a player just before the fixed four-minute grace boundary", () => {
    const sim = makeSim();
    const player = sim.addPlayer("Boundary", "boundary-client");
    sim.markDisconnected(player.playerId);
    stepN(sim, TICK_RATE * 239);
    expect(sim.addPlayer("Boundary", "boundary-client", player.resumeToken)).toMatchObject({
      playerId: player.playerId,
      resumed: true,
    });
  });

  it("resumes the same safe-room return stack and rejects stolen resume tokens", () => {
    const sim = makeSim();
    const player = sim.addPlayer("A", "client-a");
    const entity = sim.getPlayerEntity(player.playerId)!;
    const door = findSafeRoomDoor(sim);
    const floorX = door.x + 0.5;
    const floorY = door.y + 0.5;
    teleport(entity, floorX, floorY, sim);
    sim.queueAction(player.playerId, { type: "interact" });
    sim.step();
    const safe = safeRoomFeatures(door.doorCx, door.doorCy);
    const personalDoor = safe.doors[0]!;
    teleport(entity, personalDoor.x + 0.5, personalDoor.y + 0.5, sim);
    sim.queueAction(player.playerId, { type: "interact" });
    sim.step();
    const personal = { x: entity.body.x, y: entity.body.y };
    sim.markDisconnected(player.playerId);
    expect(sim.addPlayer("A", "client-a", player.resumeToken).resumed).toBe(true);
    expect(entity.body).toMatchObject(personal);
    const thief = sim.addPlayer("A", "client-evil", player.resumeToken);
    expect(thief).toMatchObject({ resumed: false });
    expect(thief.playerId).not.toBe(player.playerId);
    const features = personalRoomFeatures(0);
    teleport(entity, features.exit.x + 0.5, features.exit.y + 0.5, sim);
    sim.queueAction(player.playerId, { type: "interact" });
    sim.step();
    expect(entity.body.x).toBeCloseTo(personalDoor.x + 0.5, 3);
    teleport(entity, safe.exit.x + 0.5, safe.exit.y + 0.5, sim);
    sim.queueAction(player.playerId, { type: "interact" });
    sim.step();
    expect(entity.body).toMatchObject({ x: floorX, y: floorY });
  });

  it("reaps disconnected players after the fixed four-minute grace boundary", () => {
    const sim = makeSim();
    const player = sim.addPlayer("A", "client-a");
    sim.getInventory(player.playerId)![0] = { item: "knife", qty: 1 };
    sim.markDisconnected(player.playerId);
    stepN(sim, TICK_RATE * 241);
    expect(sim.playerCount).toBe(0);
    const observer = sim.addPlayer("B", "client-b");
    expect(sim.step().get(observer.playerId)?.entities.some((entry) => entry.kind === "item" && entry.defId === "knife")).toBe(true);
  });
});
