import { describe, expect, it } from "vitest";
import { makeSim } from "../integration/support.js";

describe("admin player positioning", () => {
  it("teleports a player to explicit walkable coordinates", () => {
    const sim = makeSim();
    const joined = sim.addPlayer({ name: "Target", clientId: "coordinate-target" });
    const destination = { x: joined.spawn.x + 0.25, y: joined.spawn.y };

    const result = sim.admin.execute({
      op: "teleport",
      playerId: joined.playerId,
      destination: "coordinates",
      ...destination,
    }, null);

    expect(result.ok).toBe(true);
    expect(sim.getPlayerEntity(joined.playerId)?.body).toMatchObject(destination);
  });
});
