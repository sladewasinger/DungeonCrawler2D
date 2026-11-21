import { describe, expect, it } from "vitest";
import { FLOOR_SEMANTIC, TERRAIN, TILE, type FloorGenerationSnapshot } from "@dc2d/engine";
import { drawGenerationPreview, fitGenerationPreview } from "./generationPreviewProjection.js";

describe("generation preview final surface truth", () => {
  it("refuses final Bedrock route edges and connector owners", () => {
    const drawing = drawingContext();
    const snapshot = finalSurfaceSnapshot(TILE.Bedrock);
    drawGenerationPreview({
      context: drawing.context,
      snapshot,
      projection: fitGenerationPreview(snapshot.bounds, drawing.context.canvas),
      showRoutes: true,
    });

    expect(drawing.routeStrokes()).toBe(0);
    expect(drawing.connectorFills()).toBe(0);
  });

  it("draws the same metadata when its authoritative final surface is valid", () => {
    const drawing = drawingContext();
    const snapshot = finalSurfaceSnapshot(TILE.Floor);
    drawGenerationPreview({
      context: drawing.context,
      snapshot,
      projection: fitGenerationPreview(snapshot.bounds, drawing.context.canvas),
      showRoutes: true,
    });

    expect(drawing.routeStrokes()).toBe(1);
    expect(drawing.connectorFills()).toBe(1);
  });
});

function finalSurfaceSnapshot(secondTile: number): FloorGenerationSnapshot {
  return {
    stageId: "final-validated", stageIndex: 5,
    bounds: {
      minX: 0, minY: 0, width: 2, height: 1, maxX: 1, maxY: 0,
      minChunkX: 0, minChunkY: 0, maxChunkX: 0, maxChunkY: 0,
    },
    tiles: new Uint8Array([TILE.Floor, secondTile]),
    terrain: new Uint8Array([TERRAIN.Floor, TERRAIN.Floor]),
    features: new Uint8Array(2), featureFaces: new Uint8Array(2),
    featureHeight: new Float32Array(2), height: new Float32Array(2),
    semantic: new Uint8Array([FLOOR_SEMANTIC.Corridor, FLOOR_SEMANTIC.Corridor]),
    roomWallIds: new Int16Array(2).fill(-1), territory: new Uint8Array(2),
    region: new Uint16Array(2), featureIds: new Int16Array(2).fill(-1),
    protectedCells: new Uint8Array([1, 1]),
    surfaceValidation: { status: "validated", failures: [] },
    rooms: [], featureStamps: [], territoryLayouts: [],
    routes: [[{ x: 0, y: 0 }, { x: 1, y: 0 }]],
    connectors: [{ x: 1, y: 0, regionIds: [1, 2], loop: false, protected: true, pathSaving: 0 }],
    fingerprint: "surface-truth",
  };
}

function drawingContext(): {
  readonly context: CanvasRenderingContext2D;
  readonly routeStrokes: () => number;
  readonly connectorFills: () => number;
} {
  let fillStyle = "";
  let strokes = 0;
  let cyanFills = 0;
  const context = {
    canvas: { width: 80, height: 40 }, clearRect: () => {},
    get fillStyle() { return fillStyle; }, set fillStyle(value: string) { fillStyle = value; },
    fillRect: () => { if (fillStyle === "#3fe0d0") cyanFills++; },
    strokeStyle: "", lineWidth: 0, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
    stroke: () => { strokes++; },
  } as unknown as CanvasRenderingContext2D;
  return { context, routeStrokes: () => strokes, connectorFills: () => cyanFills };
}
