import { type Entity, type MiniBossArenaSite } from "@dc2d/engine";
import { spawnEnemy } from "../../../core/helpers.js";
import {
  addEnemyTestPlayer,
  createEnemyTestSim,
} from "../enemyAiTestSupport.js";
import type { EnemySlot, SimState } from "../../../state/state.js";
import { launchOilLob } from "../../elemental/oilLob.js";
import { findArena } from "./arenaTestFixtures.js";

export interface OilFixture {
  readonly sim: SimState;
  readonly floor: { readonly x: number; readonly y: number };
  readonly enemy: Entity;
  readonly projectile: Entity;
  readonly target: Entity;
}

export function createOilFixture(): OilFixture {
  const sim = createEnemyTestSim();
  const floor = findOpenSquare(sim, 8);
  const target = addEnemyTestPlayer(sim, {
    x: floor.x + 4.5,
    y: floor.y + 1.5,
  });
  const enemy = spawnEnemy(sim, {
    defId: "pitchbloom",
    x: floor.x + 0.5,
    y: floor.y + 1.5,
  });
  const enemySlot = sim.enemies.get(enemy.id);
  if (!enemySlot) throw new Error("missing Pitchbloom fixture");
  const projectile = launchOilLob({
    sim,
    enemy: enemySlot,
    target: target.entity.body,
  });
  return { sim, floor, enemy, projectile, target: target.entity };
}

export interface ArenaOilFixture {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly projectile: Entity;
  readonly arena: MiniBossArenaSite;
}

export function createArenaOilFixture(): ArenaOilFixture {
  const sim = createEnemyTestSim();
  const arena = findArena(sim);
  const entity = spawnEnemy(sim, {
    defId: "pitchbloom",
    x: arena.center.x + 0.5,
    y: arena.center.y + 0.5,
    arenaKey: arena.key,
  });
  const enemy = sim.enemies.get(entity.id);
  if (!enemy) throw new Error("missing arena Pitchbloom fixture");
  const projectile = launchOilLob({
    sim,
    enemy,
    target: { x: arena.center.x + 0.5, y: arena.center.y + 0.5 },
  });
  return { sim, enemy, projectile, arena };
}

interface SquareSearch {
  readonly sim: SimState;
  readonly startX: number;
  readonly startY: number;
  readonly size: number;
}

function findOpenSquare(
  sim: SimState,
  size: number,
): { readonly x: number; readonly y: number } {
  for (let y = 160; y < 260; y++) {
    for (let x = 160; x < 260; x++) {
      if (squareIsOpen({ sim, startX: x, startY: y, size })) {
        return { x, y };
      }
    }
  }
  throw new Error(`no ${size}x${size} elemental test floor`);
}

function squareIsOpen(request: SquareSearch): boolean {
  const baseHeight = request.sim.world.groundAt(
    request.startX + 0.5,
    request.startY + 0.5,
  );
  for (let y = request.startY; y < request.startY + request.size; y++) {
    if (!openRow({ ...request, startY: y, baseHeight })) return false;
  }
  return true;
}

interface OpenRow extends SquareSearch {
  readonly baseHeight: number;
}

function openRow(request: OpenRow): boolean {
  for (let x = request.startX; x < request.startX + request.size; x++) {
    if (!openCell({
      sim: request.sim,
      x,
      y: request.startY,
      baseHeight: request.baseHeight,
    })) return false;
  }
  return true;
}

interface OpenCell {
  readonly sim: SimState;
  readonly x: number;
  readonly y: number;
  readonly baseHeight: number;
}

function openCell(request: OpenCell): boolean {
  const { sim, x, y, baseHeight } = request;
  return sim.world.isWalkable(x, y)
    && !sim.world.isSanctuary(x, y)
    && sim.world.groundAt(x + 0.5, y + 0.5) === baseHeight;
}
