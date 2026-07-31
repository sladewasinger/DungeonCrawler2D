import {
  MOVE_SPEED,
  entitySnapshotSchema,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { versionedEntitySnapshot } from "../../snapshots/entitySnapshots.js";
import { stepPets } from "../index.js";
import {
  advancePets,
  claimedPet,
  forceRandom,
  TARD_ID,
} from "./petBehaviorTestSupport.js";

describe("pet unique behaviors", () => {
  it("lets Tard fart after a deterministic idle wait", () => {
    const { sim, pet } = claimedPet(TARD_ID);
    forceRandom(sim, 0);

    advancePets(sim, 81);

    expect(pet.behavior.current).toBe("toot");
    expect(pet.behavior.eventSequence).toBe(1);
  });

  it("rate-limits Tard's idle farts with a cooldown", () => {
    const { sim, pet } = claimedPet(TARD_ID);
    forceRandom(sim, 0);
    advancePets(sim, 81);
    const eventSequence = pet.behavior.eventSequence;
    const cooldownEnds = pet.behavior.cooldownUntilTick;

    while (sim.tickCount < cooldownEnds - 1) {
      sim.tickCount++;
      stepPets(sim);
    }

    expect(pet.behavior.eventSequence).toBe(eventSequence);
    expect(pet.behavior.current).toBe("idle");
  });

  it("makes Tard fart when a waiting owner starts moving", () => {
    const { sim, pet, owner } = claimedPet(TARD_ID);
    forceRandom(sim, 1);
    advancePets(sim, 81);
    expect(pet.behavior.eventSequence).toBe(0);

    owner.entity.body.x += 0.2;
    sim.replicationMotion.set(owner.entity.id, { x: MOVE_SPEED, y: 0 });
    sim.tickCount++;
    stepPets(sim);

    expect(pet.behavior.current).toBe("toot");
    expect(pet.behavior.eventSequence).toBe(1);
  });

  it("makes Tard fart when its own idle drift starts moving", () => {
    const { sim, pet } = claimedPet(TARD_ID);
    forceRandom(sim, 1);
    pet.ownerStillTicks = 80;
    pet.driftTarget = { x: pet.entity.body.x + 1, y: pet.entity.body.y };
    sim.replicationMotion.set(pet.entity.id, { x: MOVE_SPEED, y: 0 });

    sim.tickCount++;
    stepPets(sim);

    expect(pet.behavior.current).toBe("toot");
    expect(pet.behavior.eventSequence).toBe(1);
  });

  it("does not repeat Tard's movement fart while that movement continues", () => {
    const { sim, pet } = claimedPet(TARD_ID);
    pet.ownerStillTicks = 80;
    pet.driftTarget = { x: pet.entity.body.x + 1, y: pet.entity.body.y };
    sim.replicationMotion.set(pet.entity.id, { x: MOVE_SPEED, y: 0 });

    sim.tickCount++;
    stepPets(sim);
    sim.tickCount++;
    stepPets(sim);

    expect(pet.behavior.eventSequence).toBe(1);
  });

  it("exposes Doux's tail chase without changing its authoritative position", () => {
    const { sim, pet } = claimedPet("pet-dino-doux");
    pet.nextDriftTick = 1000;
    forceRandom(sim, 0);
    const before = { x: pet.entity.body.x, y: pet.entity.body.y };
    advancePets(sim, 121);
    const position = { x: pet.entity.body.x, y: pet.entity.body.y };
    sim.tickCount++;
    stepPets(sim);

    expect(pet.behavior.current).toBe("tail_chase");
    expect(position).toEqual(before);
    expect(pet.entity.body.x).toBe(position.x);
    expect(pet.entity.body.y).toBe(position.y);
  });

  it("keeps pets without unique behavior idle while ordinary following remains available", () => {
    const { sim, pet, owner } = claimedPet("pet-dino-mort");
    pet.nextDriftTick = 1000;
    forceRandom(sim, 0);

    advancePets(sim, 200);

    expect(pet.behavior).toMatchObject({ current: "idle", eventSequence: 0 });
    const before = pet.entity.body.x;
    owner.entity.body.x += 5;
    sim.tickCount++;
    stepPets(sim);

    expect(pet.entity.body.x).toBeGreaterThan(before);
    expect(pet.behavior).toMatchObject({ current: "idle", eventSequence: 0 });
  });

  it("replicates behavior state and only changes its cached revision on behavior changes", () => {
    const { sim, pet } = claimedPet(TARD_ID);
    const first = versionedEntitySnapshot(sim, pet.entity);
    const unchanged = versionedEntitySnapshot(sim, pet.entity);
    forceRandom(sim, 0);
    advancePets(sim, 81);
    const changed = versionedEntitySnapshot(sim, pet.entity);

    expect(entitySnapshotSchema.parse(first.snapshot)).toMatchObject({
      petBehavior: "idle",
      petBehaviorEvent: 0,
    });
    expect(unchanged).toBe(first);
    expect(changed.revision).toBe(first.revision + 1);
    expect(changed.snapshot).toMatchObject({
      petBehavior: "toot",
      petBehaviorEvent: 1,
    });
  });
});
