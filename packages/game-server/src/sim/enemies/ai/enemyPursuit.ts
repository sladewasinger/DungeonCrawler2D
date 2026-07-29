import type { Entity, MoveInput, WorldView } from "@dc2d/engine";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";

interface LedgeTransitionInput {
  readonly world: WorldView;
  readonly enemy: Entity;
  readonly move: MoveInput;
}

interface TilePoint {
  readonly x: number;
  readonly y: number;
}

/** Starts a jump only when the next movement edge rises by one ledge. */
export function withLedgeTransitionJump(
  input: LedgeTransitionInput,
): MoveInput {
  if (input.move.jump || !input.enemy.body.grounded) return input.move;
  const shouldJump = destinationTiles(input).some((tile) =>
    isJumpableTransition(input.world, currentTile(input.enemy), tile)
  );
  return shouldJump ? { ...input.move, jump: true } : input.move;
}

function currentTile(enemy: Entity): TilePoint {
  return {
    x: Math.floor(enemy.body.x),
    y: Math.floor(enemy.body.y),
  };
}

function destinationTiles(input: LedgeTransitionInput): TilePoint[] {
  const current = currentTile(input.enemy);
  const destinations: TilePoint[] = [];
  if (input.move.moveX !== 0) {
    destinations.push({
      x: current.x + Math.sign(input.move.moveX),
      y: current.y,
    });
  }
  if (input.move.moveY !== 0) {
    destinations.push({
      x: current.x,
      y: current.y + Math.sign(input.move.moveY),
    });
  }
  return destinations;
}

function isJumpableTransition(
  world: WorldView,
  from: TilePoint,
  to: TilePoint,
): boolean {
  if (!world.isWalkable(to.x, to.y) || isStairTransition(world, from, to)) {
    return false;
  }
  const rise = tileGround(world, to) - tileGround(world, from);
  const tuning = ENEMY_SIMULATION_TUNING.perception;
  return Math.abs(rise - tuning.jumpRiseTiles) <=
    tuning.jumpHeightTolerance;
}

function tileGround(world: WorldView, tile: TilePoint): number {
  return world.groundAt(tile.x + 0.5, tile.y + 0.5);
}

function isStairTransition(
  world: WorldView,
  from: TilePoint,
  to: TilePoint,
): boolean {
  return world.stairHeightAt(from.x + 0.5, from.y + 0.5) !== null ||
    world.stairHeightAt(to.x + 0.5, to.y + 0.5) !== null;
}
