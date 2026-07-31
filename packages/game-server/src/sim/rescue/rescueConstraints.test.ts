import { CHUNK_SIZE, ROOM_REGION_CY } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { rescueConstraints } from "./rescueConstraints.js";
import { createRescueFixture, RescueTestWorld } from "./rescueTestSupport.js";

describe("rescue constraints", () => {
  it("rejects sanctuary and reserved safe-room tiles as destinations", () => {
    const world = new RescueTestWorld();
    world.setSanctuary(4, 0);
    const { sim, slot } = createRescueFixture(world);
    const constraints = rescueConstraints(sim, slot);

    expect(constraints.allowsTile(4, 0)).toBe(false);
    expect(constraints.allowsTile(0, ROOM_REGION_CY * CHUNK_SIZE)).toBe(false);
  });
});
