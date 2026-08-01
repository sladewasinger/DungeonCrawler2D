import { TILE } from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { spawnEnemy } from "../../../core/helpers.js";
import type { SimState } from "../../../state/state.js";
import { stepEnemies } from "../../index.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "../enemyAiTestSupport.js";
import {
  hasMovedFrom,
  spawnStartPoints,
} from "./attackSpacingTestHelpers.js";
import {
  assertCorridorState,
  corridorSpawnPoints,
  type CorridorProgress,
} from "./enemyAiCorridorFormationAssertions.js";

describe("enemy melee corridor formations", () => {
  let sim: SimState;
  let spot: { x: number; y: number };

  beforeEach(() => {
    sim = createEnemyTestSim();
    spot = findEnemyTestFloor(sim);
    addEnemyTestPlayer(sim, spot);
  });

  it("preserves corridor progress without deadlocking melee attackers", () => {
    const tileX = Math.floor(spot.x);
    const tileY = Math.floor(spot.y);
    const walls: Array<{ x: number; y: number; tile: (typeof TILE)[keyof typeof TILE] }> = [];
    for (let dy = -2; dy <= 5; dy += 1) {
      walls.push(
        { x: tileX - 1, y: tileY + dy, tile: TILE.CraftingTable },
        { x: tileX, y: tileY + dy, tile: TILE.Floor },
        { x: tileX + 1, y: tileY + dy, tile: TILE.CraftingTable },
      );
    }
    sim.world.replaceTileOverrides(walls);
    const spawnPoints = corridorSpawnPoints(sim, tileX, tileY);
    expect(spawnPoints).toHaveLength(3);
    for (const point of spawnPoints) {
      spawnEnemy(sim, { defId: "skeleton", x: point.x, y: point.y });
    }
    const starts = spawnStartPoints(sim);
    const player = sim.players.get("p1")?.entity;
    if (!player) throw new Error("missing corridor player");
    const progress = new Map<string, CorridorProgress>();

    for (let tick = 0; tick < 80; tick += 1) {
      stepEnemies(sim, []);
      assertCorridorState({
        sim,
        player,
        progress,
        enforceOverlapAllowance: tick >= 15,
      });
    }

    const skeletons = [...sim.enemies.values()].filter((enemy) => enemy.def.id === "skeleton");
    expect(skeletons.some(hasMovedFrom(starts))).toBe(true);
    const slots = skeletons
      .map((enemy) => enemy.attackReservation)
      .filter((reservation) => reservation?.kind === "melee-slot")
      .map((reservation) => `${reservation.x},${reservation.y}`);
    expect(slots.length).toBeGreaterThan(0);
    const bodyPoints = new Set(skeletons.map((enemy) =>
      `${enemy.entity.body.x},${enemy.entity.body.y}`,
    ));
    expect(bodyPoints.size).toBeGreaterThan(1);
    const centerCount = skeletons.filter((enemy) =>
      Math.hypot(enemy.entity.body.x - player.body.x, enemy.entity.body.y - player.body.y) < 0.35,
    ).length;
    expect(centerCount).toBeLessThan(skeletons.length);
    expect(player.hp).toBeLessThan(player.maxHp);
    const progressStates = [...progress.values()];
    expect(progressStates).toHaveLength(3);
    expect(progressStates.every((state) => state.progressed || state.holdReason)).toBe(true);
    expect(progressStates.filter((state) => !state.moved).length).toBeLessThan(2);
  });
});
