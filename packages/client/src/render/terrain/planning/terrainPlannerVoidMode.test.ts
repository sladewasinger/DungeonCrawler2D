import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, LEVEL, TERRAIN, World, hashString } from "@dc2d/engine";
import { VIEW_ORIENTATIONS } from "../../view/orientation/viewOrientation.js";
import { viewTileToWorld, worldTileToView } from "../../view/transform/viewTransform.js";
import { createTerrainSource } from "../runtime/source.js";
import { planTerrain, TERRAIN_KINDS, type TerrainKind } from "./terrainPlanner.js";

const key = (x: number, y: number): string => `${x},${y}`;

describe("disabled VOID terrain presentation", () => {
  it.each(VIEW_ORIENTATIONS)("rejects leaked VOID throughout the sampled apron at orientation %i", (orientation) => {
    const bounds = { x: 10, y: 10, width: 1, height: 1 };
    for (const [dx, dy] of SAMPLE_OFFSETS) {
      const terrain = new Map<string, TerrainKind>([[key(bounds.x + dx, bounds.y + dy), TERRAIN_KINDS.Void]]);
      expect(() => planTerrain({
        voidTerrain: false, terrainAt: (x, y) => terrain.get(key(x, y)) ?? TERRAIN_KINDS.Floor,
        heightAt: () => 1,
      }, { bounds, orientation })).toThrow(/VOID terrain leaked/);
    }
  });

  it.each(VIEW_ORIENTATIONS)("retains ordinary finite wall faces at orientation %i", (orientation) => {
    const raised = { x: 10, y: 10 };
    const view = worldTileToView(raised, orientation);
    const lower = viewTileToWorld({ x: view.x, y: view.y + 1 }, orientation);
    const plan = planTerrain({
      voidTerrain: false, terrainAt: () => TERRAIN_KINDS.Floor,
      heightAt: (x, y) => key(x, y) === key(lower.x, lower.y) ? 0 : 2,
    }, { bounds: { ...raised, width: 1, height: 1 }, orientation });

    expect(plan.batches.voids).toEqual([]);
    expect(plan.batches.southFaces[0]).toMatchObject({
      topHeight: 2, bottomHeight: 0,
    });
    expect(plan.batches.southFaces[0]?.voidWall).not.toBe(true);
  });

  it.each(VIEW_ORIENTATIONS)("plans a complete disabled-mode chunk with no VOID geometry at orientation %i", (orientation) => {
    const world = new World(hashString("dev-world-1"), 1, { features: { voidTerrain: false } });
    const plan = planTerrain({
      voidTerrain: false,
      terrainAt: (x, y) => world.terrainAt(x, y) === TERRAIN.Void ? TERRAIN_KINDS.Void : TERRAIN_KINDS.Floor,
      heightAt: (x, y) => world.heightAt(x, y),
    }, { bounds: { x: 0, y: 0, width: CHUNK_SIZE, height: CHUNK_SIZE }, orientation });

    expect(plan.batches.voids).toEqual([]);
    expect(plan.batches.southFaces.every((face) => face.voidWall !== true)).toBe(true);
    expect(plan.batches.cliffEdges.every((edge) => edge.voidBoundary !== true)).toBe(true);
  });

  it("plans the Combat Sandbox authored exterior when ordinary VOID is disabled", () => {
    const world = new World(hashString("combat-sandbox"), 1, {
      level: LEVEL.CombatSandbox,
      features: { voidTerrain: false },
    });
    const plan = planTerrain(createTerrainSource(world), {
      bounds: { x: -33, y: -33, width: 1, height: 1 },
      orientation: 0,
    });

    expect(world.features.voidTerrain).toBe(true);
    expect(plan.batches.voids).toHaveLength(1);
  });
});

const SAMPLE_OFFSETS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
] as const;
