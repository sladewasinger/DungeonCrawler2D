import { TERRAIN } from "@dc2d/engine";
import { vi } from "vitest";
import type { EnemySlot, PlayerSlot, SimState } from "../../../state/state.js";
import { stepEnemies } from "../../index.js";
import { slotWalkable } from "../../ai/attackSpacing/attackSpacingUtils.js";
import { asMeleeReservation } from "./attackSpacingTestHelpers.js";

interface SteppedWall {
  readonly x: number;
  readonly y: number;
  readonly height: number;
}

export function applySteppedCorner(sim: SimState, spot: { x: number; y: number }): void {
  const tileX = Math.floor(spot.x);
  const tileY = Math.floor(spot.y);
  const baseGround = sim.world.groundAt(spot.x, spot.y);
  const walls: readonly SteppedWall[] = [
    { x: tileX + 1, y: tileY, height: 1 },
    { x: tileX + 1, y: tileY - 1, height: 2 },
  ];
  vi.spyOn(sim.world, "isWalkable").mockReturnValue(true);
  vi.spyOn(sim.world, "isSanctuary").mockReturnValue(false);
  vi.spyOn(sim.world, "terrainAt").mockReturnValue(TERRAIN.Floor);
  vi.spyOn(sim.world, "groundAt").mockImplementation((x, y) =>
    steppedGround({ walls, baseGround, x, y }));
}

function steppedGround(input: {
  readonly walls: readonly SteppedWall[];
  readonly baseGround: number;
  readonly x: number;
  readonly y: number;
}): number {
  const wall = input.walls.find((candidate) =>
    candidate.x === Math.floor(input.x) && candidate.y === Math.floor(input.y),
  );
  return input.baseGround + (wall?.height ?? 0);
}

export function hasAxisReversal(positions: readonly { x: number; y: number }[]): boolean {
  let previous = { x: 0, y: 0 };
  for (let index = 1; index < positions.length; index += 1) {
    const current = {
      x: positions[index]!.x - positions[index - 1]!.x,
      y: positions[index]!.y - positions[index - 1]!.y,
    };
    if (opposes(previous.x, current.x) || opposes(previous.y, current.y)) return true;
    if (Math.abs(current.x) > 0.0001 || Math.abs(current.y) > 0.0001) previous = current;
  }
  return false;
}

function opposes(previous: number, current: number): boolean {
  return Math.abs(previous) > 0.0001 && Math.abs(current) > 0.0001 && previous * current < 0;
}

export function requireCornerEnemy(sim: SimState, id: string): EnemySlot {
  const enemy = sim.enemies.get(id);
  if (!enemy) throw new Error("missing stepped-wall enemy");
  return enemy;
}

export function requireCornerPlayer(sim: SimState): PlayerSlot {
  const player = sim.players.get("p1");
  if (!player) throw new Error("missing stepped-wall player");
  return player;
}

export interface CornerSettlement {
  readonly positions: readonly { x: number; y: number }[];
  readonly reservations: ReadonlySet<string>;
  readonly progressed: boolean;
  readonly holding: boolean;
}

interface CornerSettlementState {
  readonly positions: Array<{ x: number; y: number }>;
  readonly reservations: Set<string>;
  firstGoalDistance?: number;
  progressed: boolean;
}

export function settleCorner(input: {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly player: PlayerSlot["entity"];
}): CornerSettlement {
  const state: CornerSettlementState = {
    positions: [],
    reservations: new Set(),
    progressed: false,
  };
  const stationaryPosition = { x: input.player.body.x, y: input.player.body.y };
  for (let tick = 0; tick < 80; tick += 1) {
    stepEnemies(input.sim, []);
    holdPlayerStill(input.player, stationaryPosition);
    recordCornerTick(input.sim, input.enemy, state);
  }
  return {
    positions: state.positions,
    reservations: state.reservations,
    progressed: state.progressed,
    holding: input.enemy.meleeFormation?.kind === "hold",
  };
}

function holdPlayerStill(
  player: PlayerSlot["entity"],
  position: { readonly x: number; readonly y: number },
): void {
  player.body.x = position.x;
  player.body.y = position.y;
  player.body.kx = 0;
  player.body.ky = 0;
}

function recordCornerTick(
  sim: SimState,
  enemy: EnemySlot,
  state: CornerSettlementState,
): void {
  state.positions.push({ x: enemy.entity.body.x, y: enemy.entity.body.y });
  const reservation = enemy.attackReservation;
  if (!reservation || reservation.kind !== "melee-slot") return;
  const meleeReservation = asMeleeReservation(reservation);
  state.reservations.add(`${meleeReservation.x},${meleeReservation.y}`);
  const distance = Math.hypot(
    enemy.entity.body.x - meleeReservation.x,
    enemy.entity.body.y - meleeReservation.y,
  );
  const baseline = state.firstGoalDistance ?? distance;
  state.firstGoalDistance ??= distance;
  if (distance < baseline - 0.05) state.progressed = true;
  if (!slotWalkable(sim, enemy, meleeReservation)) {
    throw new Error("corner reservation became unwalkable");
  }
}
