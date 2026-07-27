import type Phaser from "phaser";
import { describe, expect, it } from "vitest";
import {
  Phaser4TerrainQuadBatchRenderer,
  type Terrain4BatchMaterials,
  type Terrain4ScreenProjection,
} from "./phaser4QuadBatch.js";
import type { Terrain4Batches } from "../planning/terrainPlanner.js";

type GraphicsCall =
  | readonly ["clear"]
  | readonly ["fillStyle", number, number]
  | readonly ["fillTriangle", number, number, number, number, number, number];

class RecordingGraphics {
  readonly calls: GraphicsCall[] = [];

  clear(): this {
    this.calls.push(["clear"]);
    return this;
  }

  fillStyle(color: number, alpha: number): this {
    this.calls.push(["fillStyle", color, alpha]);
    return this;
  }

  fillTriangle(...points: readonly [number, number, number, number, number, number]): this {
    this.calls.push(["fillTriangle", ...points]);
    return this;
  }
}

describe("Phaser4TerrainQuadBatchRenderer", () => {
  it("clears and submits each planner batch as Phaser 4 Graphics triangles", () => {
    const graphics = new RecordingGraphics();
    const renderer = new Phaser4TerrainQuadBatchRenderer(graphics as unknown as Phaser.GameObjects.Graphics);
    const batches: Terrain4Batches = {
      voids: [],
      features: [],
      props: [],
      cliffEdges: [],
      ao: [],
      floors: [{
        kind: "floor", worldTile: { x: 0, y: 0 }, viewTile: { x: 0, y: 0 }, height: 3,
        vertices: [{ x: 1, y: 2, z: 3 }, { x: 3, y: 2, z: 3 }, { x: 3, y: 5, z: 3 }, { x: 1, y: 5, z: 3 }],
      }],
      southFaces: [{
        kind: "south-face", worldTile: { x: 0, y: 0 }, viewTile: { x: 0, y: 0 }, topHeight: 3, bottomHeight: 1,
        vertices: [{ x: 1, y: 5, z: 3 }, { x: 3, y: 5, z: 3 }, { x: 3, y: 5, z: 1 }, { x: 1, y: 5, z: 1 }],
      }],
    };

    renderer.render(batches, screenProjection, materials);

    expect(graphics.calls).toEqual([
      ["clear"],
      ["fillStyle", 0x7d9ec0, 1],
      ["fillTriangle", 10, 20, 30, 20, 30, 50],
      ["fillTriangle", 10, 20, 30, 50, 10, 50],
      ["fillStyle", 0x4a4a70, 0.8],
      ["fillTriangle", 10, 50, 30, 50, 30, 50],
      ["fillTriangle", 10, 50, 30, 50, 10, 50],
    ]);
  });

  it("clears the Graphics object when the next planner batch is empty", () => {
    const graphics = new RecordingGraphics();
    const renderer = new Phaser4TerrainQuadBatchRenderer(graphics as unknown as Phaser.GameObjects.Graphics);

    renderer.render({ floors: [], voids: [], features: [], props: [], southFaces: [], cliffEdges: [], ao: [] }, screenProjection, materials);

    expect(graphics.calls).toEqual([["clear"]]);
  });
});

const screenProjection: Terrain4ScreenProjection = {
  project: ({ x, y }) => ({ x: x * 10, y: y * 10 }),
};

const materials: Terrain4BatchMaterials = {
  floor: { color: 0x7d9ec0 },
  feature: { color: 0x7d9ec0 },
  void: { color: 0x000000 },
  southFace: { color: 0x4a4a70, alpha: 0.8 },
};
