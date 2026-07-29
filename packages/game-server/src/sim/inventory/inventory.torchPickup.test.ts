import {
  createBody,
  makeEntity,
  newEntityId,
  resetEntityIds,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { doPickup, invQty } from "./inventory.js";
import { buildSim, buildSlot, fakeWorld } from "./inventory.testSupport.js";

beforeEach(() => {
  resetEntityIds();
});

function pickUpPlacedTorch(defId: string | undefined) {
  const sim = buildSim(fakeWorld());
  const slot = buildSlot(5, 5);
  const torch = createPlacedTorch(defId);
  sim.torches.set(torch.id, torch);
  doPickup(sim, slot);
  return { sim, slot, torch };
}

function createPlacedTorch(defId: string | undefined) {
  const body = createBody(5.2, 5, 0);
  const options = { id: newEntityId("t"), torchState: "placed" as const };
  if (defId === undefined) return makeEntity("torch", body, options);
  return makeEntity("torch", body, { ...options, defId });
}

describe("inventory: placed torch pickup", () => {
  it("returns the placed torch's actual item definition", () => {
    const { sim, slot, torch } = pickUpPlacedTorch("ember-torch");
    expect(invQty(slot, "ember-torch")).toBe(1);
    expect(sim.torches.has(torch.id)).toBe(false);
  });

  it("uses the legacy basic torch when a placed entity has no definition", () => {
    const { slot } = pickUpPlacedTorch(undefined);
    expect(invQty(slot, "torch")).toBe(1);
  });
});
