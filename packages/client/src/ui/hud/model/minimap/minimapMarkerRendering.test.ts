import { describe, expect, it, vi } from "vitest";
import { drawMinimapLandmark } from "./minimapCanvasPrimitives.js";
import { MinimapCanvasRenderer } from "./minimapCanvasRenderer.js";
import type {
  MinimapLandmarkKind,
  MinimapSnapshot,
} from "./minimapTypes.js";

describe("minimap marker rendering", () => {
  it("draws terrain beneath entity markers instead of replacing the terrain layer", () => {
    const terrainContext = new FakeMinimapContext();
    vi.stubGlobal("document", {
      createElement: () => ({ getContext: () => terrainContext }),
    });
    try {
      const context = new FakeMinimapContext();
      new MinimapCanvasRenderer().render({
        canvas: fakeCanvas(),
        context: context as unknown as CanvasRenderingContext2D,
        bearingDeg: 0,
        snapshot: {
          ...emptySnapshot(),
          terrain: [{ x: 0, y: 0, height: 2, walkable: true }],
          entities: [{ kind: "enemy", x: 0, y: 0 }],
        },
      });

      expect(terrainContext.fillRectCount).toBe(1);
      expect(context.drawImageCount).toBe(1);
      expect(context.operations.lastIndexOf("fill")).toBeGreaterThan(
        context.operations.indexOf("drawImage"),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses the landmark legend colors and projects an off-map safe room to the edge", () => {
    const safeRoom = drawLandmark("safeRoom", 0, -20);
    const miniBossArena = drawLandmark("miniBossArena", 0, -2);
    const stairs = drawLandmark("stairs", 0, -2);

    expect(safeRoom.fillStyle).toBe("#4ea8ff");
    expect(safeRoom.translations).toEqual([{ x: 0, y: -36 }]);
    expect(miniBossArena.fillStyle).toBe("#ef5350");
    expect(stairs.fillStyle).toBe("#ffd54c");
  });

  it("caps entity and landmark drawing work", () => {
    const context = new FakeMinimapContext();
    new MinimapCanvasRenderer().render({
      canvas: fakeCanvas(),
      context: context as unknown as CanvasRenderingContext2D,
      bearingDeg: 0,
      snapshot: markerHeavySnapshot(),
    });

    expect(context.arcs.filter((radius) => radius === 2.5)).toHaveLength(64);
    expect(context.fillRectCount).toBe(8);
  });
});

function drawLandmark(kind: MinimapLandmarkKind, x: number, y: number): FakeMinimapContext {
  const context = new FakeMinimapContext();
  drawMinimapLandmark({
    context: context as unknown as CanvasRenderingContext2D,
    snapshot: emptySnapshot(),
    bearingDeg: 0,
    radius: 40,
    landmark: { kind, x, y },
  });
  return context;
}

function markerHeavySnapshot(): MinimapSnapshot {
  return {
    ...emptySnapshot(),
    entities: Array.from({ length: 65 }, () => ({ kind: "enemy", x: 0, y: 0 })),
    landmarks: Array.from({ length: 9 }, () => ({ kind: "safeRoom", x: 0, y: 0 })),
  };
}

function emptySnapshot(): MinimapSnapshot {
  return {
    centerX: 0,
    centerY: 0,
    rangeTiles: 8,
    terrain: [],
    entities: [],
    landmarks: [],
  };
}

function fakeCanvas(): HTMLCanvasElement {
  return {
    clientWidth: 80,
    clientHeight: 80,
    width: 0,
    height: 0,
  } as HTMLCanvasElement;
}

class FakeMinimapContext {
  readonly arcs: number[] = [];
  readonly translations: Array<{ x: number; y: number }> = [];
  readonly operations: string[] = [];
  fillRectCount = 0;
  drawImageCount = 0;
  fillStyle = "";
  strokeStyle = "";
  lineWidth = 1;
  globalAlpha = 1;

  setTransform(): void {}
  clearRect(): void {}
  save(): void {}
  restore(): void {}
  beginPath(): void {}
  fill(): void { this.operations.push("fill"); }
  stroke(): void {}
  clip(): void {}
  moveTo(): void {}
  lineTo(): void {}
  rotate(): void {}
  drawImage(): void { this.drawImageCount += 1; this.operations.push("drawImage"); }

  translate(x: number, y: number): void {
    this.translations.push({ x, y });
  }

  arc(_: number, __: number, radius: number): void {
    this.arcs.push(radius);
  }

  fillRect(): void {
    this.fillRectCount += 1;
  }
}
