import type { MinimapTerrainTile } from "./minimapTypes.js";

interface TerrainRenderRequest {
  readonly terrain: readonly MinimapTerrainTile[];
  readonly centerX: number;
  readonly centerY: number;
  readonly size: number;
  readonly radius: number;
}

export interface MinimapTerrainLayer {
  readonly canvas: HTMLCanvasElement;
  readonly offsetX: number;
  readonly offsetY: number;
}

const RANGE_TILES = 16;

export class MinimapTerrainRenderer {
  private readonly canvas: HTMLCanvasElement | null;
  private readonly context: CanvasRenderingContext2D | null;
  private source: readonly MinimapTerrainTile[] | null = null;
  private size = 0;
  private originX = 0;
  private originY = 0;

  constructor() {
    this.canvas = createCanvas();
    this.context = this.canvas?.getContext?.("2d") ?? null;
  }

  render(request: TerrainRenderRequest): MinimapTerrainLayer | null {
    const { terrain, centerX, centerY, size, radius } = request;
    if (!this.canvas || !this.context) return null;
    const tileSize = radius / RANGE_TILES;
    const originX = Math.floor(centerX);
    const originY = Math.floor(centerY);
    this.updateLayer({ terrain, size, originX, originY, tileSize });
    return {
      canvas: this.canvas,
      offsetX: (originX - centerX) * tileSize,
      offsetY: (originY - centerY) * tileSize,
    };
  }

  private updateLayer(request: {
    readonly terrain: readonly MinimapTerrainTile[];
    readonly size: number;
    readonly originX: number;
    readonly originY: number;
    readonly tileSize: number;
  }): void {
    const { terrain, size, originX, originY, tileSize } = request;
    if (this.source === terrain && this.size === size && this.originX === originX && this.originY === originY) return;
    this.source = terrain;
    this.size = size;
    this.originX = originX;
    this.originY = originY;
    if (!this.canvas || !this.context) return;
    this.canvas.width = size;
    this.canvas.height = size;
    this.context.clearRect(0, 0, size, size);
    for (const tile of terrain) {
      this.context.fillStyle = terrainColor(tile.height, tile.walkable);
      this.context.fillRect(
        size / 2 + (tile.x - originX) * tileSize - tileSize / 2,
        size / 2 + (tile.y - originY) * tileSize - tileSize / 2,
        tileSize + 0.5,
        tileSize + 0.5,
      );
    }
  }
}

const terrainColor = (height: number, walkable: boolean): string => {
  if (!walkable) return "rgba(8, 10, 18, .72)";
  const lightness = Math.max(24, Math.min(54, 34 + height * 5));
  return `hsl(220 16% ${lightness}% / .62)`;
};

const createCanvas = (): HTMLCanvasElement | null => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  return typeof canvas.getContext === "function" ? canvas : null;
};
