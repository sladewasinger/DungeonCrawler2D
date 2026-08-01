import {
  CHUNK_SIZE,
  NEUTRAL_INPUT,
  containsPoint,
  miniBossArenaForChunk,
} from "@dc2d/engine";
import type { EnemySlot, PlayerSlot, SimState } from "../../state/state.js";
import { isMiniBossArenaOccupant } from "./runtime.js";

export function canMiniBossArenaEnemyTarget(
  sim: SimState,
  enemy: EnemySlot,
  playerId: string,
): boolean {
  const arenaKey = enemy.arenaKey;
  if (!arenaKey) return true;
  return isValidInsideOccupant(sim, arenaKey, playerId);
}

/** Returns false while a live arena encounter has nobody valid to engage. */
export function prepareMiniBossArenaEnemy(
  sim: SimState,
  enemy: EnemySlot,
): boolean {
  const arenaKey = enemy.arenaKey;
  if (!arenaKey) return true;
  const validOccupants = validInsideOccupants(sim, arenaKey);
  if (validOccupants.size === 0) {
    resetDormantEnemy(enemy);
    return false;
  }
  clearOutsideTargetState(enemy, validOccupants);
  return true;
}

function validInsideOccupants(
  sim: SimState,
  arenaKey: string,
): ReadonlySet<string> {
  const valid = new Set<string>();
  for (const playerId of sim.players.keys()) {
    if (isValidInsideOccupant(sim, arenaKey, playerId)) valid.add(playerId);
  }
  return valid;
}

function isValidInsideOccupant(
  sim: SimState,
  arenaKey: string,
  playerId: string,
): boolean {
  if (!isMiniBossArenaOccupant(sim, arenaKey, playerId)) return false;
  const slot = sim.players.get(playerId);
  if (!slot || !isActiveArenaOccupant(slot)) return false;
  return arenaContainsPlayer(sim, arenaKey, slot.entity.body);
}

function isActiveArenaOccupant(
  slot: PlayerSlot,
): boolean {
  return slot.connected && slot.entity.hp > 0 &&
    slot.downedAtTick === null && slot.respawnAtTick === null;
}

function arenaContainsPlayer(
  sim: SimState,
  arenaKey: string,
  body: EnemySlot["entity"]["body"],
): boolean {
  const arena = miniBossArenaForChunk({
    worldSeed: sim.world.worldSeed,
    floor: sim.world.floor,
    cx: Math.floor(body.x / CHUNK_SIZE),
    cy: Math.floor(body.y / CHUNK_SIZE),
  });
  return arena?.key === arenaKey &&
    containsPoint(arena.interior, body.x, body.y);
}

function resetDormantEnemy(enemy: EnemySlot): void {
  enemy.brain.targetId = null;
  clearEnemyMemoryState(enemy);
  enemy.brain.wanderDir = NEUTRAL_INPUT;
  enemy.brain.wanderLeft = 0;
  enemy.animation = { state: "idle", ticksRemaining: 0 };
  delete enemy.elementalAttack;
  enemy.entity.body.kx = 0;
  enemy.entity.body.ky = 0;
}

function clearOutsideTargetState(
  enemy: EnemySlot,
  validOccupants: ReadonlySet<string>,
): void {
  const clearedTarget = clearOutsideBrainTarget(enemy, validOccupants);
  clearOutsideMemory(enemy, validOccupants);
  clearOutsideAnimation(enemy, validOccupants, clearedTarget);
}

function clearOutsideBrainTarget(
  enemy: EnemySlot,
  validOccupants: ReadonlySet<string>,
): boolean {
  const targetId = enemy.brain.targetId;
  if (targetId === null || validOccupants.has(targetId)) return false;
  enemy.brain.targetId = null;
  return true;
}

function clearOutsideMemory(
  enemy: EnemySlot,
  validOccupants: ReadonlySet<string>,
): void {
  const rememberedId = enemy.brain.rememberedTarget?.targetId;
  if (!rememberedId || validOccupants.has(rememberedId)) return;
  clearEnemyMemoryState(enemy);
}

function clearEnemyMemoryState(enemy: EnemySlot): void {
  enemy.brain.rememberedTarget = null;
  enemy.brain.memorySecondsRemaining = 0;
  enemy.brain.memoryPhase = "pursuing";
  enemy.brain.memorySearchSecondsRemaining = 0;
  enemy.rememberedRoute = null;
}

function clearOutsideAnimation(
  enemy: EnemySlot,
  validOccupants: ReadonlySet<string>,
  clearedTarget: boolean,
): void {
  const animationTargetId = enemy.animation.target?.targetId;
  const outsideAnimationTarget = animationTargetId !== undefined &&
    !validOccupants.has(animationTargetId);
  const outsideMeleeTarget = clearedTarget &&
    enemy.animation.state === "attack";
  if (!outsideAnimationTarget && !outsideMeleeTarget) return;
  enemy.animation = { state: "idle", ticksRemaining: 0 };
  delete enemy.elementalAttack;
}
