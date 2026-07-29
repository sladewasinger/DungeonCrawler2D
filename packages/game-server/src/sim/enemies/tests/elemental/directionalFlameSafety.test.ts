import {
  miniBossArenaAtPosition,
  safeRoomSpawn,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { spawnEnemy } from "../../../core/helpers.js";
import {
  blockSurfaceCell,
  mockTerrainCrest,
  type BoundaryKind,
} from "./elementalBoundaryTestSupport.js";
import {
  createArenaFlameFixture,
  createFlameFixture,
} from "./flameTestFixtures.js";
import { flameCellIsReachable } from "../../elemental/flameBoundary.js";
import { stepDirectionalFlame } from "../../elemental/directionalFlame.js";

describe("Chort directional flame safety boundaries", () => {
  it.each([
    ["ordinary wall", "walkable"],
    ["bedrock", "bedrock"],
    ["void", "void"],
  ] as const)("does not cross a %s", (_name, boundary: BoundaryKind) => {
    const fixture = createFlameFixture(2);
    blockSurfaceCell(fixture.sim, {
      cell: { x: fixture.tileX + 1, y: fixture.tileY },
      boundary,
    });
    fixture.sim.areas.place({
      defId: "area-oil",
      x: fixture.tileX + 1,
      y: fixture.tileY,
      steps: 0,
    });

    const complete = stepDirectionalFlame({
      sim: fixture.sim,
      enemy: fixture.enemy,
      effectEvents: [],
    });

    expect(complete).toBe(true);
    expect(fixture.player.hp).toBe(30);
    expect(fixture.sim.areas.defAt(fixture.tileX + 1, fixture.tileY))
      .toBe("area-oil");
  });

  it("does not cross a crest even when every terrain cell is walkable", () => {
    const fixture = createFlameFixture(2);
    mockTerrainCrest(fixture.sim, {
      cell: { x: fixture.tileX + 1, y: fixture.tileY },
      height: 2,
    });

    const complete = stepDirectionalFlame({
      sim: fixture.sim,
      enemy: fixture.enemy,
      effectEvents: [],
    });

    expect(complete).toBe(true);
    expect(fixture.player.hp).toBe(30);
    expect(fixture.sim.areas.size).toBe(0);
  });

  it("rejects sanctuary and interior-room targets", () => {
    const fixture = createFlameFixture(1);
    const sanctuary = safeRoomSpawn(0, 0);
    const roomSourceEntity = spawnEnemy(fixture.sim, {
      defId: "chort",
      x: sanctuary.x,
      y: sanctuary.y,
    });
    const roomSource = fixture.sim.enemies.get(roomSourceEntity.id);
    if (!roomSource) throw new Error("missing room Chort fixture");

    expect(flameCellIsReachable({
      sim: fixture.sim,
      enemy: fixture.enemy,
      x: Math.floor(sanctuary.x),
      y: Math.floor(sanctuary.y),
    })).toBe(false);
    expect(flameCellIsReachable({
      sim: fixture.sim,
      enemy: roomSource,
      x: fixture.tileX,
      y: fixture.tileY,
    })).toBe(false);
  });

  it("keeps a Chort inside its mini-boss arena", () => {
    const fixture = createArenaFlameFixture();
    const gate = fixture.arena.gates[0];
    if (!gate) throw new Error("arena has no gate");

    expect(flameCellIsReachable({
      sim: fixture.sim,
      enemy: fixture.enemy,
      x: Math.floor(gate.outside.x),
      y: Math.floor(gate.outside.y),
    })).toBe(false);
    expect(flameCellIsReachable({
      sim: fixture.sim,
      enemy: fixture.enemy,
      x: fixture.arena.center.x,
      y: fixture.arena.center.y,
    })).toBe(true);
    expect(miniBossArenaAtPosition(
      fixture.sim.world,
      fixture.enemy.entity.body.x,
      fixture.enemy.entity.body.y,
    )?.key).toBe(fixture.arena.key);
  });
});
