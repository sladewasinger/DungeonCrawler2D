import {
  CHUNK_SIZE,
  COMBAT_SANDBOX_LAYOUT,
  LEVEL,
  PET_DEFINITIONS,
  TICK_RATE,
  type CombatSandboxFixtureRow,
} from "@dc2d/engine";
import { spawnItem } from "../core/helpers.js";
import { spawnPet } from "../pets/index.js";
import type { SimState } from "../state/state.js";

export const COMBAT_SANDBOX_RESEED_TICKS =
  COMBAT_SANDBOX_LAYOUT.fixtureReseedSeconds * TICK_RATE;

export function populateCombatSandboxChunk(
  sim: SimState,
  cx: number,
  cy: number,
): boolean {
  if (sim.world.level !== LEVEL.CombatSandbox || !chunkIntersectsArena(cx, cy)) return false;
  seedCombatSandboxItems(sim, cx, cy);
  seedCombatSandboxPets(sim, cx, cy);
  seedCombatSandboxAreas(sim, cx, cy);
  sim.combatSandboxFixturesActive = true;
  return true;
}

export function reseedCombatSandboxFixtures(sim: SimState): void {
  if (sim.world.level !== LEVEL.CombatSandbox) return;
  seedCombatSandboxItems(sim);
  seedCombatSandboxAreas(sim);
}

function seedCombatSandboxItems(sim: SimState, cx?: number, cy?: number): void {
  const definitions = [...sim.content.items.values()].sort((a, b) => a.id.localeCompare(b.id));
  const weapons = definitions.filter((definition) => definition.weapon);
  const items = definitions.filter((definition) => !definition.weapon);
  seedItemRow({ sim, definitions: weapons, row: COMBAT_SANDBOX_LAYOUT.fixtureRows.weapons, cx, cy });
  seedItemRow({ sim, definitions: items, row: COMBAT_SANDBOX_LAYOUT.fixtureRows.items, cx, cy });
}

interface ItemRowSeed {
  readonly sim: SimState;
  readonly definitions: readonly { readonly id: string }[];
  readonly row: CombatSandboxFixtureRow;
  readonly cx: number | undefined;
  readonly cy: number | undefined;
}

function seedItemRow({ sim, definitions, row, cx, cy }: ItemRowSeed): void {
  for (const [index, definition] of definitions.entries()) {
    const position = fixturePosition(row, index);
    if (!belongsToChunk(position, cx, cy) || itemExists(sim, definition.id, position)) continue;
    spawnItem(sim, { defId: definition.id, ...position });
  }
}

function seedCombatSandboxPets(sim: SimState, cx?: number, cy?: number): void {
  const definitions = [...PET_DEFINITIONS].sort((a, b) => a.id.localeCompare(b.id));
  for (const [index, definition] of definitions.entries()) {
    const position = fixturePosition(COMBAT_SANDBOX_LAYOUT.fixtureRows.pets, index);
    if (!belongsToChunk(position, cx, cy) || petExists(sim, definition.id)) continue;
    spawnPet(sim, { definition, position });
  }
}

function seedCombatSandboxAreas(sim: SimState, cx?: number, cy?: number): void {
  const definitions = [...sim.content.areas.values()].sort((a, b) => a.id.localeCompare(b.id));
  const row = COMBAT_SANDBOX_LAYOUT.fixtureRows.areas;
  for (const [index, definition] of definitions.entries()) {
    const position = fixturePosition(row, index, false);
    if (!belongsToChunk(position, cx, cy) || sim.areas.defsAt(position.x, position.y).includes(definition.id)) continue;
    sim.areas.spawn({ defId: definition.id, ...position, radius: row.radius });
  }
}

function fixturePosition(
  row: CombatSandboxFixtureRow,
  index: number,
  centered = true,
): { x: number; y: number } {
  const column = index % row.columns;
  const line = Math.floor(index / row.columns);
  const x = row.x + column * row.spacing;
  const y = row.y + line * row.rowSpacing;
  return centered ? { x, y } : { x: Math.floor(x), y: Math.floor(y) };
}

function itemExists(sim: SimState, defId: string, position: { x: number; y: number }): boolean {
  return [...sim.items.values()].some((item) =>
    item.defId === defId && Math.hypot(item.body.x - position.x, item.body.y - position.y) < 0.25
  );
}

function petExists(sim: SimState, defId: string): boolean {
  return [...sim.pets.values()].some((pet) => pet.definition.id === defId);
}

function belongsToChunk(
  position: { x: number; y: number },
  cx: number | undefined,
  cy: number | undefined,
): boolean {
  if (cx === undefined || cy === undefined) return true;
  return Math.floor(position.x / CHUNK_SIZE) === cx && Math.floor(position.y / CHUNK_SIZE) === cy;
}

function chunkIntersectsArena(cx: number, cy: number): boolean {
  const { origin, width, height } = COMBAT_SANDBOX_LAYOUT.arena;
  const chunkLeft = cx * CHUNK_SIZE;
  const chunkTop = cy * CHUNK_SIZE;
  return chunkLeft < origin.x + width && chunkLeft + CHUNK_SIZE > origin.x &&
    chunkTop < origin.y + height && chunkTop + CHUNK_SIZE > origin.y;
}
