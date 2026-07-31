import { COMBAT_SANDBOX_LAYOUT } from "@dc2d/engine";
import type { SimState } from "../state/state.js";
import { findWalkableNear } from "./search.js";

const SPAWN_SPACING = 2;
const SPAWN_COLUMNS = 4;
const SPAWN_SEARCH_RADIUS = 48;

export function findCombatSandboxSpawn(
  sim: SimState,
): { x: number; y: number; z: number } {
  const { playerSpawn } = COMBAT_SANDBOX_LAYOUT;
  const index = sim.players.size;
  const x = playerSpawn.x + (index % SPAWN_COLUMNS) * SPAWN_SPACING;
  const y = playerSpawn.y + Math.floor(index / SPAWN_COLUMNS) * SPAWN_SPACING;
  const tile = findWalkableNear({ sim, x: Math.floor(x), y: Math.floor(y) }) ?? findWalkableNear({
    sim,
    x: Math.floor(playerSpawn.x),
    y: Math.floor(playerSpawn.y),
    maxRadius: SPAWN_SEARCH_RADIUS,
  });
  if (!tile) throw new Error("Combat Sandbox has no walkable player spawn");
  const centered = { x: tile.x + 0.5, y: tile.y + 0.5 };
  return { ...centered, z: sim.world.groundAt(centered.x, centered.y) };
}
