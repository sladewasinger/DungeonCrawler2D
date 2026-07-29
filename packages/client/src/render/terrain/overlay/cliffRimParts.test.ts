import { describe, expect, it } from "vitest";
import type {
  TerrainCliffEdgeQuad,
  TerrainCliffSide,
} from "../geometry/terrainPlannerModel.js";
import { groupCliffRimParts } from "./cliffRimParts.js";

const VERTICES = [
  { x: 4, y: 7, z: 2 },
  { x: 5, y: 7, z: 2 },
  { x: 5, y: 8, z: 2 },
  { x: 4, y: 8, z: 2 },
] as const;

function middleEdge(side: TerrainCliffSide): TerrainCliffEdgeQuad {
  return {
    kind: "cliff-edge",
    cliff: "middle",
    rotation: 0,
    height: 2,
    sides: [side],
    worldTile: { x: 4, y: 7 },
    viewTile: { x: 4, y: 7 },
    vertices: VERTICES,
  };
}

describe("cliff rim parts", () => {
  it("rounds both corners formed by three separately emitted sides", () => {
    const grouped = groupCliffRimParts([
      middleEdge("north"),
      middleEdge("east"),
      middleEdge("south"),
    ]);
    const parts = [...grouped.values()].flat();
    const corners = parts
      .filter((part) => part.kind === "corner")
      .map((part) => part.corner);
    const east = parts.find((part) => {
      return part.kind === "side" && part.side === "east";
    });

    expect(corners).toEqual(["ne", "se"]);
    expect(east).toMatchObject({ corners: ["ne", "se"] });
  });
});
