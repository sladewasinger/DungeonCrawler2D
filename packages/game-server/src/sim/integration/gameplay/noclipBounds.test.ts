import { LEVEL } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { makeSim } from "../support.js";

describe("finite admin noclip bounds", () => {
  it("keeps movement and debug teleports inside the finite floor", () => {
    const finite = makeSim(102, { debugCommands: true, level: LEVEL.Dungeon });
    const join = finite.addPlayer({ name: "Finite admin", clientId: "finite-admin" });
    finite.admin.execute({ op: "assignAdmin", playerId: join.playerId, enabled: true }, null);
    finite.queueAction(join.playerId, { type: "debug", op: "noclip", on: true });
    finite.step();

    const bounds = finite.world.floorBounds;
    const entity = finite.getPlayerEntity(join.playerId);
    if (!bounds || !entity) throw new Error("missing finite admin fixture");
    entity.body.x = bounds.maxX + 0.5;
    entity.body.y = bounds.maxY + 0.5;
    finite.handleInput(join.playerId, {
      type: "input", seq: 1, projectedServerTick: 0, moveX: 1, moveY: 1, jump: false, run: false,
    });
    finite.step();
    expect(entity.body.x).toBeLessThanOrEqual(bounds.maxX + 0.5);
    expect(entity.body.y).toBeLessThanOrEqual(bounds.maxY + 0.5);

    finite.queueAction(join.playerId, { type: "debug", op: "teleport", x: bounds.maxX + 500, y: bounds.maxY + 500 });
    finite.step();
    expect(entity.body.x).toBeLessThanOrEqual(bounds.maxX + 0.5);
    expect(entity.body.y).toBeLessThanOrEqual(bounds.maxY + 0.5);
  }, 30_000);
});
