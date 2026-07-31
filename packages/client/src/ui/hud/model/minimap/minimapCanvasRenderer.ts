import {
  drawMinimapEntity,
  drawMinimapGrid,
  drawMinimapLandmark,
} from "./minimapCanvasPrimitives.js";
import {
  MinimapTerrainRenderer,
  type MinimapTerrainLayer,
} from "./minimapTerrainRenderer.js";
import type { MinimapSnapshot } from "./minimapTypes.js";

const FALLBACK_SIZE = 58;
const MAX_PIXEL_RATIO = 2;
const MAX_ENTITY_MARKERS = 64;
const MAX_LANDMARK_MARKERS = 8;

export interface MinimapCanvasRenderRequest {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D | null;
  readonly bearingDeg: number;
  readonly snapshot?: MinimapSnapshot;
}

export class MinimapCanvasRenderer {
  private readonly terrain = new MinimapTerrainRenderer();

  render(request: MinimapCanvasRenderRequest): void {
    const { canvas, context, bearingDeg, snapshot } = request;
    if (!context) return;
    const size = minimapRenderedSize(canvas);
    const ratio = pixelRatio();
    syncCanvas(canvas, size, ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size, size);
    context.save();
    context.translate(size / 2, size / 2);
    const radius = Math.max(1, size / 2 - 5);
    drawMinimapGrid(context, radius);
    if (snapshot) drawSnapshot({ context, snapshot, bearingDeg, size, radius, terrain: this.terrain });
    context.restore();
  }
}

interface SnapshotRenderRequest {
  readonly context: CanvasRenderingContext2D;
  readonly snapshot: MinimapSnapshot;
  readonly bearingDeg: number;
  readonly size: number;
  readonly radius: number;
  readonly terrain: MinimapTerrainRenderer;
}

const drawSnapshot = (request: SnapshotRenderRequest): void => {
  const { context, snapshot, bearingDeg, radius } = request;
  drawTerrain(request);
  drawEntities({ context, snapshot, bearingDeg, radius });
  drawLandmarks({ context, snapshot, bearingDeg, radius });
};

const drawTerrain = (request: SnapshotRenderRequest): void => {
  const { context, snapshot, bearingDeg, size, radius, terrain } = request;
  const layer = terrain.render({
    terrain: snapshot.terrain,
    centerX: snapshot.centerX,
    centerY: snapshot.centerY,
    size,
    radius,
  });
  if (!layer) return;
  context.save();
  clipCircle(context, radius);
  context.rotate((bearingDeg * Math.PI) / 180);
  context.globalAlpha = 0.58;
  drawTerrainLayer(context, layer, size);
  context.restore();
};

const drawTerrainLayer = (
  context: CanvasRenderingContext2D,
  layer: MinimapTerrainLayer,
  size: number,
): void => {
  context.drawImage(
    layer.canvas,
    -size / 2 + layer.offsetX,
    -size / 2 + layer.offsetY,
    size,
    size,
  );
};

interface MarkerRenderRequest {
  readonly context: CanvasRenderingContext2D;
  readonly snapshot: MinimapSnapshot;
  readonly bearingDeg: number;
  readonly radius: number;
}

const drawEntities = ({
  context,
  snapshot,
  bearingDeg,
  radius,
}: MarkerRenderRequest): void => {
  let count = 0;
  for (const entity of snapshot.entities) {
    if (count === MAX_ENTITY_MARKERS) return;
    drawMinimapEntity({ context, snapshot, bearingDeg, radius, entity });
    count += 1;
  }
};

const drawLandmarks = ({
  context,
  snapshot,
  bearingDeg,
  radius,
}: MarkerRenderRequest): void => {
  let count = 0;
  for (const landmark of snapshot.landmarks) {
    if (count === MAX_LANDMARK_MARKERS) return;
    drawMinimapLandmark({ context, snapshot, bearingDeg, radius, landmark });
    count += 1;
  }
};

const clipCircle = (context: CanvasRenderingContext2D, radius: number): void => {
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.clip();
};

export const minimapRenderedSize = (canvas: HTMLCanvasElement): number => Math.max(
  1,
  Math.floor(Math.min(canvas.clientWidth || FALLBACK_SIZE, canvas.clientHeight || FALLBACK_SIZE)),
);

const pixelRatio = (): number => Math.min(
  MAX_PIXEL_RATIO,
  Math.max(1, globalThis.devicePixelRatio ?? 1),
);

const syncCanvas = (
  canvas: HTMLCanvasElement,
  size: number,
  ratio: number,
): void => {
  const pixels = Math.max(1, Math.floor(size * ratio));
  if (canvas.width === pixels && canvas.height === pixels) return;
  canvas.width = pixels;
  canvas.height = pixels;
};
