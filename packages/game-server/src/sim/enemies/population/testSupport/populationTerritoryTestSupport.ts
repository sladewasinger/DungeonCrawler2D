import { expect } from "vitest";
import type { SimState } from "../../../state/state.js";
import { enemyRosterAtPosition } from "../../populationRoster.js";

export function sampleTerritories(sim: SimState): Map<string, { x: number; y: number }> {
  const bounds = sim.world.floorBounds;
  if (!bounds) throw new Error("missing finite floor bounds");
  const samples = new Map<string, { x: number; y: number }>();
  const spanX = Math.ceil((bounds.maxX - bounds.minX) / 8);
  const spanY = Math.ceil((bounds.maxY - bounds.minY) / 8);
  const points = Array.from({ length: (spanX + 1) * (spanY + 1) }, (_, index) => ({
    x: bounds.minX + (index % (spanX + 1)) * 8,
    y: bounds.minY + Math.floor(index / (spanX + 1)) * 8,
  }));
  return points.reduce((result, point) => addTerritorySample(sim, result, point), samples);
}

function addTerritorySample(
  sim: SimState,
  samples: Map<string, { x: number; y: number }>,
  point: { x: number; y: number },
): Map<string, { x: number; y: number }> {
  if (samples.size >= 4) return samples;
  const territory = sim.world.territoryAtWorldTile(point.x, point.y);
  const profile = territory === null ? undefined : sim.world.generatedFloor?.territories[territory];
  if (profile && !samples.has(profile.id)) samples.set(profile.id, point);
  return samples;
}

export function expectTerritoryRoster(sim: SimState, id: string, point: { x: number; y: number }): void {
  const roster = enemyRosterAtPosition(sim, point.x, point.y);
  expect(roster.length).toBeGreaterThanOrEqual(3);
  const expected = {
    "goblin-powderworks": "goblin",
    "silkbound-broodcourt": "spitter",
    "chainwarden-gaol": "skeleton",
    "cultist-star-chapel": "chort",
  }[id];
  if (expected) expect(roster).toContain(expected);
}
