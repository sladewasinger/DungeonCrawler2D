import { TILE, type Entity } from "@dc2d/engine";
import { spawnEnemy } from "../../../core/helpers.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
  findEnemyTestFloor,
} from "../enemyAiTestSupport.js";
import type { EnemySlot, SimState } from "../../../state/state.js";
import { beginDirectionalFlame } from "../../elemental/directionalFlame.js";
import { findArena } from "./arenaTestFixtures.js";
import type { MiniBossArenaSite } from "@dc2d/engine";

export interface FlameFixture {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly player: Entity;
  readonly tileX: number;
  readonly tileY: number;
}

export function createFlameFixture(
  offsetX: number,
  offsetY = 0,
): FlameFixture {
  const sim = createEnemyTestSim();
  const spot = findEnemyTestFloor(sim);
  clearFlameTestArea(sim, spot);
  const player = addEnemyTestPlayer(sim, {
    x: spot.x + offsetX,
    y: spot.y + offsetY,
  });
  const entity = spawnEnemy(sim, {
    defId: "chort",
    x: spot.x,
    y: spot.y,
  });
  const enemy = sim.enemies.get(entity.id);
  if (!enemy) throw new Error("missing Chort fixture");
  beginDirectionalFlame({ enemy, target: player.entity.body });
  return {
    sim,
    enemy,
    player: player.entity,
    tileX: Math.floor(spot.x),
    tileY: Math.floor(spot.y),
  };
}

function clearFlameTestArea(
  sim: SimState,
  spot: { readonly x: number; readonly y: number },
): void {
  const originX = Math.floor(spot.x);
  const originY = Math.floor(spot.y);
  const tiles = [];
  for (let offsetY = -3; offsetY <= 3; offsetY += 1) {
    for (let offsetX = -3; offsetX <= 3; offsetX += 1) {
      tiles.push({ x: originX + offsetX, y: originY + offsetY, tile: TILE.Floor });
    }
  }
  sim.world.replaceTileOverrides(tiles);
}

export interface ArenaFlameFixture {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly arena: MiniBossArenaSite;
}

export function createArenaFlameFixture(): ArenaFlameFixture {
  const sim = createEnemyTestSim();
  const arena = findArena(sim);
  const entity = spawnEnemy(sim, {
    defId: "chort",
    x: arena.center.x + 0.5,
    y: arena.center.y + 0.5,
    arenaKey: arena.key,
  });
  const enemy = sim.enemies.get(entity.id);
  if (!enemy) throw new Error("missing arena Chort fixture");
  return { sim, enemy, arena };
}
