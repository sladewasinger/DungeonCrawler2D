import { safeRoomSpawn } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { addEnemyTestPlayer } from "../enemyAiTestSupport.js";
import {
  blockSurfaceCell,
  mockTerrainCrest,
  type BoundaryKind,
} from "./elementalBoundaryTestSupport.js";
import {
  createArenaOilFixture,
  createOilFixture,
} from "./oilTestFixtures.js";
import { resolveOilLobImpact } from "../../elemental/oilLob.js";

describe("Pitchbloom oil lob safety boundaries", () => {
  it.each([
    ["ordinary wall", "walkable"],
    ["bedrock", "bedrock"],
    ["void", "void"],
  ] as const)("does not spill oil through a %s", (_name, boundary: BoundaryKind) => {
    const fixture = createOilFixture();
    blockSurfaceCell(fixture.sim, {
      cell: { x: fixture.floor.x + 1, y: fixture.floor.y + 1 },
      boundary,
    });
    resolveOilLobImpact({
      sim: fixture.sim,
      projectile: fixture.projectile,
      point: fixture.target.body,
      directHit: null,
      effectEvents: [],
    });

    expect(fixture.sim.areas.size).toBe(0);
  });

  it("does not spill oil through an elevation crest", () => {
    const fixture = createOilFixture();
    mockTerrainCrest(fixture.sim, {
      cell: { x: fixture.floor.x + 1, y: fixture.floor.y + 1 },
      height: 2,
    });
    resolveOilLobImpact({
      sim: fixture.sim,
      projectile: fixture.projectile,
      point: fixture.target.body,
      directHit: null,
      effectEvents: [],
    });

    expect(fixture.sim.areas.size).toBe(0);
  });

  it("does not oil a sanctuary or interior-room target", () => {
    const fixture = createOilFixture();
    const sanctuary = safeRoomSpawn(0, 0);
    const target = addEnemyTestPlayer(fixture.sim, sanctuary, "safe-target");
    resolveOilLobImpact({
      sim: fixture.sim,
      projectile: fixture.projectile,
      point: target.entity.body,
      directHit: target.entity,
      effectEvents: [],
    });

    expect(target.entity.statuses).toEqual([]);
    expect(fixture.sim.areas.size).toBe(0);
  });

  it("keeps an oil footprint inside its mini-boss arena", () => {
    const fixture = createArenaOilFixture();
    const gate = fixture.arena.gates[0];
    if (!gate) throw new Error("arena has no gate");

    resolveOilLobImpact({
      sim: fixture.sim,
      projectile: fixture.projectile,
      point: gate.outside,
      directHit: null,
      effectEvents: [],
    });
    expect(fixture.sim.areas.size).toBe(0);

    resolveOilLobImpact({
      sim: fixture.sim,
      projectile: fixture.projectile,
      point: {
        x: fixture.arena.center.x + 0.5,
        y: fixture.arena.center.y + 0.5,
      },
      directHit: null,
      effectEvents: [],
    });
    expect(fixture.sim.areas.size).toBeGreaterThan(0);
  });
});
