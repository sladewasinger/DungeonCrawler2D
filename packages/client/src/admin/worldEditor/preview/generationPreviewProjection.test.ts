import { describe, expect, it } from "vitest";
import type { FloorBounds, FloorGenerationSnapshot } from "@dc2d/engine";
import {
  drawGenerationPreview,
  fitGenerationPreview,
  generationPreviewCellFromClient,
  generationPreviewCanvasPoint,
  generationPreviewCellAt,
  generationPreviewCellDescription,
  generationPreviewScreenPoint,
} from "./generationPreviewProjection.js";
import { previewCellColor } from "./generationPreviewColors.js";
import { FLOOR_SEMANTIC } from "@dc2d/engine";

const BOUNDS: FloorBounds = {
  minX: -128, minY: -128, width: 512, height: 512,
  maxX: 383, maxY: 383, minChunkX: -4, minChunkY: -4, maxChunkX: 11, maxChunkY: 11,
};

describe("generation preview projection", () => {
  it("fits the complete finite bounds inside the canvas", () => {
    const projection = fitGenerationPreview(BOUNDS, { width: 800, height: 480 });
    const topLeft = generationPreviewScreenPoint(projection, BOUNDS.minX, BOUNDS.minY);
    const bottomRight = generationPreviewScreenPoint(projection, BOUNDS.maxX + 1, BOUNDS.maxY + 1);
    expect(topLeft.x).toBeGreaterThanOrEqual(10);
    expect(topLeft.y).toBeGreaterThanOrEqual(10);
    expect(bottomRight.x).toBeLessThanOrEqual(790);
    expect(bottomRight.y).toBeLessThanOrEqual(470);
    expect(projection.scale).toBeCloseTo(460 / BOUNDS.height);
  });

  it("draws connector and feature markers while routes remain an optional overlay", () => {
    const fills: Array<{ readonly args: number[]; readonly style: string }> = [];
    let fillStyle = "";
    let strokes = 0;
    const context = {
      canvas: { width: 40, height: 40 },
      clearRect: () => {},
      get fillStyle() { return fillStyle; }, set fillStyle(value: string) { fillStyle = value; },
      fillRect: (...args: number[]) => fills.push({ args, style: fillStyle }),
      strokeStyle: "", lineWidth: 0, beginPath: () => {}, moveTo: () => {},
      lineTo: () => {}, stroke: () => { strokes++; },
    } as unknown as CanvasRenderingContext2D;
    const snapshot = {
      bounds: { ...BOUNDS, minX: 0, minY: 0, width: 2, height: 2, maxX: 1, maxY: 1 },
      semantic: new Uint8Array([1, 2, 3, 4]), height: new Float32Array([0, 1, 0, 2]),
      region: new Uint16Array([1, 2, 1, 2]), featureIds: new Int16Array([-1, 2, -1, -1]),
      routes: [
        [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        [{ x: 1, y: 0 }, { x: 0, y: 0 }],
        [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      ],
      connectors: [{ x: 1, y: 0, regionIds: [1, 2], loop: false, protected: true, pathSaving: 0 }],
      featureStamps: [{ id: "marker", kind: "stair", bounds: { x0: 0, y0: 0, x1: 1, y1: 1 }, ports: [], protectedCells: [], position: { x: 0, y: 0 } }],
    } as unknown as FloorGenerationSnapshot;
    const projection = fitGenerationPreview(snapshot.bounds, context.canvas);
    drawGenerationPreview({ context, snapshot, projection });
    expect(fills.length).toBeGreaterThan(2);
    const connectorFill = fills.find(({ style }) => style === "#3fe0d0");
    expect(connectorFill?.args[2]).toBeLessThanOrEqual(projection.scale);
    expect(connectorFill?.args[3]).toBeLessThanOrEqual(projection.scale);
    expect(strokes).toBe(0);
    drawGenerationPreview({ context, snapshot, projection, showRoutes: true });
    expect(strokes).toBe(1);
  });

  it("renders a generated transition opening with its own visible cell role", () => {
    const transition = previewCellColor({ semantic: FLOOR_SEMANTIC.Transition, height: 0, region: 0, featureId: -1 });
    const solid = previewCellColor({ semantic: FLOOR_SEMANTIC.Solid, height: 0, region: 0, featureId: -1 });
    expect(transition).not.toBe(solid);
  });

  it("maps hover cells to authored feature and room semantics", () => {
    const snapshot = {
      bounds: { ...BOUNDS, minX: 0, minY: 0, width: 3, height: 2, maxX: 2, maxY: 1 },
      semantic: new Uint8Array([3, 10, 0, 1, 0, 0]),
      height: new Float32Array(6), roomWallIds: new Int16Array([-1, 2, -1, -1, -1, -1]),
      territory: new Uint8Array([0, 0, 2, 0, 0, 0]), region: new Uint16Array(6),
      featureIds: new Int16Array([0, -1, -1, -1, -1, -1]),
      featureStamps: [{ id: "spawn", kind: "spawn-exterior", bounds: { x0: 0, y0: 0, x1: 0, y1: 0 }, ports: [], protectedCells: [] }],
      rooms: [], connectors: [], routes: [], territoryLayouts: [],
    } as unknown as FloorGenerationSnapshot;
    const projection = fitGenerationPreview(snapshot.bounds, { width: 300, height: 200 });
    const point = generationPreviewScreenPoint(projection, 0.5, 0.5);
    expect(generationPreviewCellAt(projection, point.x, point.y)).toEqual({ x: 0, y: 0 });
    expect(generationPreviewCellDescription(snapshot, 0, 0)).toContain("Spawn");
    expect(generationPreviewCellDescription(snapshot, 1, 0)).toContain("wall");
    expect(generationPreviewCellDescription(snapshot, 2, 0)).toContain("Territory");
  });

  it("resolves the displayed stage's feature, connector, and path metadata", () => {
    const snapshot = {
      bounds: { ...BOUNDS, minX: 0, minY: 0, width: 3, height: 1, maxX: 2, maxY: 0 },
      semantic: new Uint8Array([0, 9, 1]), height: new Float32Array(3),
      roomWallIds: new Int16Array([-1, -1, -1]), territory: new Uint8Array(3),
      region: new Uint16Array([1, 2, 3]), featureIds: new Int16Array([-1, -1, -1]),
      featureStamps: [{ id: "safe", kind: "safe-room", bounds: { x0: 0, y0: 0, x1: 0, y1: 0 }, ports: [], protectedCells: [], position: { x: 0, y: 0 } }],
      connectors: [{ x: 1, y: 0, regionIds: [1, 2], loop: false, protected: true, pathSaving: 0 }],
      routes: [[{ x: 2, y: 0 }]], rooms: [], territoryLayouts: [],
    } as unknown as FloorGenerationSnapshot;
    expect(generationPreviewCellDescription(snapshot, 0, 0)).toContain("Safe room");
    expect(generationPreviewCellDescription(snapshot, 1, 0)).toContain("Connector point");
    expect(generationPreviewCellDescription(snapshot, 2, 0)).toContain("Protected route debug overlay");
  });

  it("maps a CSS-scaled pointer over a rendered feature to the same cell", () => {
    const canvas = { width: 800, height: 480 };
    const projection = fitGenerationPreview({ ...BOUNDS, minX: 0, minY: 0, width: 4, height: 4, maxX: 3, maxY: 3 }, canvas);
    const rendered = generationPreviewScreenPoint(projection, 1.5, 1.5);
    const client = generationPreviewCanvasPoint({
      canvas, rect: { left: 20, top: 10, width: 400, height: 240 },
      clientX: rendered.x / 2 + 20, clientY: rendered.y / 2 + 10,
    });
    expect(generationPreviewCellAt(projection, client.x, client.y)).toEqual({ x: 1, y: 1 });
  });

  it("maps through the canvas content box used by the rendered preview", () => {
    const canvas = { width: 800, height: 480, clientWidth: 798, clientHeight: 478, clientLeft: 1, clientTop: 1 };
    const bounds = { ...BOUNDS, minX: 0, minY: 0, width: 4, height: 4, maxX: 3, maxY: 3 };
    const projection = fitGenerationPreview(bounds, canvas);
    const rendered = generationPreviewScreenPoint(projection, 1.5, 1.5);
    const cell = generationPreviewCellFromClient({
      projection, canvas, rect: { left: 20, top: 10, width: 800, height: 480 },
      clientX: 20 + 1 + rendered.x * canvas.clientWidth / canvas.width,
      clientY: 10 + 1 + rendered.y * canvas.clientHeight / canvas.height,
    });
    expect(cell).toEqual({ x: 1, y: 1 });
  });

  it("keeps an edge feature marker inside the same rendered/hit-tested bounds", () => {
    const canvas = { width: 800, height: 480 };
    const bounds = { ...BOUNDS, minX: 0, minY: 0, width: 4, height: 4, maxX: 3, maxY: 3 };
    const projection = fitGenerationPreview(bounds, canvas);
    const rendered = generationPreviewScreenPoint(projection, bounds.maxX + 0.5, bounds.maxY + 0.5);
    const point = generationPreviewCanvasPoint({
      canvas, rect: { left: 20, top: 10, width: 400, height: 240 },
      clientX: rendered.x / 2 + 20, clientY: rendered.y / 2 + 10,
    });
    expect(generationPreviewCellAt(projection, point.x, point.y)).toEqual({ x: bounds.maxX, y: bounds.maxY });
  });

  it("draws a bright cursor pixel at the mapped cell center", () => {
    const styles: string[] = [];
    const context = {
      canvas: { width: 80, height: 80 }, clearRect: () => {}, fillStyle: "", fillRect: () => {},
      strokeStyle: "", lineWidth: 0, beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
    } as unknown as CanvasRenderingContext2D;
    Object.defineProperty(context, "fillStyle", { set(value: string) { styles.push(value); } });
    const snapshot = {
      bounds: { ...BOUNDS, minX: 0, minY: 0, width: 2, height: 2, maxX: 1, maxY: 1 },
      semantic: new Uint8Array(4), height: new Float32Array(4), roomWallIds: new Int16Array(4),
      territory: new Uint8Array(4), region: new Uint16Array(4), featureIds: new Int16Array(4).fill(-1),
      featureStamps: [], routes: [], rooms: [], connectors: [], territoryLayouts: [],
    } as unknown as FloorGenerationSnapshot;
    drawGenerationPreview({ context, snapshot, projection: fitGenerationPreview(snapshot.bounds, context.canvas), cursor: { x: 1, y: 1 } });
    expect(styles).toContain("#ffffff");
  });
});
