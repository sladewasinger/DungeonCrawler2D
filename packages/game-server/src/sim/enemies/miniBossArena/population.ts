import {
  miniBossArenaIsStamped,
  miniBossArenaForChunk,
  type MiniBossArenaSite,
} from "@dc2d/engine";
import { syncWorldFeatureOverrides } from "../../core/worldFeatureOverrides.js";
import { spawnEnemy } from "../../core/helpers.js";
import type { EnemySlot, SimState } from "../../state/state.js";
import {
  miniBossEncounterMembers,
  type MiniBossEncounterMember,
} from "./encounterPlacement.js";
import { markMiniBossArenaDefeated } from "./defeatedArenaState.js";
import { clearMiniBossArena } from "./runtime.js";

export function handleMiniBossEnemyDeath(
  sim: SimState,
  enemy: EnemySlot,
): void {
  const arenaKey = enemy.arenaKey;
  if (!arenaKey || !enemy.arenaLeader ||
      !markMiniBossArenaDefeated(sim, arenaKey)) return;
  clearMiniBossArena(sim, arenaKey);
  endArenaEnemyConstraints(sim, arenaKey);
  syncWorldFeatureOverrides(sim);
}

export function spawnMiniBossEncounter(
  sim: SimState,
  cx: number,
  cy: number,
): boolean {
  const arena = miniBossArenaForChunk({
    worldSeed: sim.world.worldSeed,
    floor: sim.world.floor,
    cx,
    cy,
    generatedFloor: sim.world.generatedFloor,
  });
  if (!arena ||
      !miniBossArenaIsStamped(sim.world, arena) ||
      encounterUnavailable(sim, arena)) return false;
  const members = miniBossEncounterMembers({
    sim,
    arena,
  });
  if (members.length === 0) return false;
  spawnEncounterMembers(sim, arena, members);
  return true;
}

export function miniBossEncounterAlive(
  sim: SimState,
  arenaKey: string,
): boolean {
  return [...sim.enemies.values()].some((enemy) =>
    enemy.arenaKey === arenaKey && enemy.arenaLeader
  );
}

function encounterUnavailable(
  sim: SimState,
  arena: MiniBossArenaSite,
): boolean {
  return sim.defeatedMiniBossArenas.has(arena.key) ||
    encounterExists(sim, arena.key);
}

function encounterExists(sim: SimState, arenaKey: string): boolean {
  return [...sim.enemies.values()].some((enemy) =>
    enemy.arenaKey === arenaKey
  );
}

function endArenaEnemyConstraints(sim: SimState, arenaKey: string): void {
  for (const enemy of sim.enemies.values()) {
    if (enemy.arenaKey !== arenaKey) continue;
    delete enemy.arenaKey;
    delete enemy.arenaLeader;
    delete enemy.home;
  }
}

function spawnEncounterMembers(
  sim: SimState,
  arena: MiniBossArenaSite,
  members: readonly MiniBossEncounterMember[],
): void {
  for (const member of members) {
    spawnEnemy(sim, {
      defId: member.defId,
      x: member.x,
      y: member.y,
      home: arena.interior,
      arenaKey: arena.key,
      ...(member.arenaLeader ? { arenaLeader: true } : {}),
    });
  }
}
