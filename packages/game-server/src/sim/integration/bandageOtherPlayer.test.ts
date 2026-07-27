import { INTERACT_RANGE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { makeSim, teleport } from "./support.js";

describe("bandaging another player", () => {
  it("heals a nearby living target and consumes the healer's bandage", () => {
    const sim = makeSim(1234, { testFixtures: true, freezeEnemies: true });
    const healer = sim.addPlayer({ name: "Healer", clientId: "bandage-healer" });
    const patient = sim.addPlayer({ name: "Patient", clientId: "bandage-patient" });
    const healerEntity = sim.getPlayerEntity(healer.playerId)!;
    const patientEntity = sim.getPlayerEntity(patient.playerId)!;
    teleport({ entity: patientEntity, x: healerEntity.body.x + INTERACT_RANGE - 0.1, y: healerEntity.body.y, sim: sim });
    patientEntity.hp = 10;

    sim.queueAction(healer.playerId, {
      type: "useSlot",
      slot: 1,
      targetId: patient.playerId,
    });
    const snapshots = sim.step();

    expect(patientEntity.hp).toBe(14);
    expect(patientEntity.statuses.some((status) => status.defId === "bandaged")).toBe(true);
    expect(sim.getInventory(healer.playerId)?.find((stack) => stack.item === "bandage")?.qty)
      .toBe(1);
    expect(snapshots.get(healer.playerId)?.events).toContainEqual({
      t: "health",
      id: patient.playerId,
      delta: 4,
      kind: "heal",
    });
  });

  it("rejects an out-of-range target without consuming the bandage", () => {
    const sim = makeSim(1234, { testFixtures: true, freezeEnemies: true });
    const healer = sim.addPlayer({ name: "Healer", clientId: "far-bandage-healer" });
    const patient = sim.addPlayer({ name: "Patient", clientId: "far-bandage-patient" });
    const healerEntity = sim.getPlayerEntity(healer.playerId)!;
    const patientEntity = sim.getPlayerEntity(patient.playerId)!;
    teleport({ entity: patientEntity, x: healerEntity.body.x + INTERACT_RANGE + 1, y: healerEntity.body.y, sim: sim });
    patientEntity.hp = 10;

    sim.queueAction(healer.playerId, {
      type: "useSlot",
      slot: 1,
      targetId: patient.playerId,
    });
    sim.step();

    expect(patientEntity.hp).toBe(10);
    expect(sim.getInventory(healer.playerId)?.find((stack) => stack.item === "bandage")?.qty)
      .toBe(2);
  });
});
