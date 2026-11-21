import type Phaser from "phaser";

export const SAFE_HOUSE_TEXTURE_KEY = "forest-safe-house";

const WIDTH = 80;
const HEIGHT = 64;
const NEAREST_FILTER = 1 as Phaser.Textures.FilterMode;

export function ensureSafeHouseTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SAFE_HOUSE_TEXTURE_KEY)) return;
  const texture = scene.textures.createCanvas(SAFE_HOUSE_TEXTURE_KEY, WIDTH, HEIGHT);
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawChimney(ctx);
  drawCabinWalls(ctx);
  drawPitchedRoof(ctx);
  drawWindows(ctx);
  drawFrontDoor(ctx);
  texture.refresh();
  texture.setFilter(NEAREST_FILTER);
}

function drawChimney(ctx: CanvasRenderingContext2D): void {
  rect(ctx, "#4b4f5a", [56, 2, 10, 18]);
  rect(ctx, "#646978", [55, 2, 12, 3]);
  rect(ctx, "#353942", [58, 0, 6, 2]);
  rect(ctx, "#393d47", [57, 6, 8, 2]);
}

function drawPitchedRoof(ctx: CanvasRenderingContext2D): void {
  for (let row = 0; row < 26; row++) {
    const inset = Math.max(0, Math.floor((22 - row) * 0.45));
    const width = WIDTH - inset * 2;
    const color = row < 3 ? "#6b3c25" : roofTone(row);
    rect(ctx, color, [inset, 6 + row, width, 1]);
  }
  rect(ctx, "#3c2114", [0, 31, WIDTH, 3]);
  rect(ctx, "#8d5232", [2, 30, WIDTH - 4, 1]);
}

function roofTone(row: number): string {
  if (row % 5 === 0) return "#4a2717";
  return row % 2 === 0 ? "#7a4429" : "#693922";
}

function drawCabinWalls(ctx: CanvasRenderingContext2D): void {
  rect(ctx, "#192119", [3, 59, WIDTH - 6, 5]);
  rect(ctx, "#825533", [4, 34, WIDTH - 8, 27]);
  for (let y = 36; y < 58; y += 4) rect(ctx, "#5c3920", [4, y, WIDTH - 8, 1]);
  rect(ctx, "#4d2f1a", [4, 34, 4, 27]);
  rect(ctx, "#4d2f1a", [WIDTH - 8, 34, 4, 27]);
  rect(ctx, "#4b515c", [4, 57, WIDTH - 8, 4]);
  rect(ctx, "#6b7280", [4, 56, WIDTH - 8, 1]);
}

function drawWindows(ctx: CanvasRenderingContext2D): void {
  drawWindow(ctx, 13, 41);
  drawWindow(ctx, 55, 41);
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rect(ctx, "#3b2314", [x, y, 12, 10]);
  rect(ctx, "#f3b34b", [x + 1, y + 1, 10, 8]);
  rect(ctx, "#ffe48f", [x + 2, y + 2, 8, 6]);
  rect(ctx, "#4d2f1a", [x + 5, y + 1, 2, 8]);
  rect(ctx, "#4d2f1a", [x + 1, y + 4, 10, 2]);
  rect(ctx, "#5c3920", [x - 1, y + 10, 14, 2]);
}

function drawFrontDoor(ctx: CanvasRenderingContext2D): void {
  rect(ctx, "#3b2314", [31, 37, 18, 24]);
  rect(ctx, "#6a4024", [33, 39, 14, 22]);
  rect(ctx, "#7c4c2b", [35, 40, 10, 20]);
  rect(ctx, "#4b2c17", [39, 40, 1, 20]);
  rect(ctx, "#e8c456", [42, 49, 2, 3]);
  rect(ctx, "#245654", [37, 34, 6, 4]);
  rect(ctx, "#3dd6c3", [38, 35, 4, 2]);
  rect(ctx, "#7c8391", [30, 61, 20, 3]);
  rect(ctx, "#9ca4b3", [32, 61, 16, 2]);
}

function rect(
  ctx: CanvasRenderingContext2D,
  color: string,
  box: readonly [number, number, number, number],
): void {
  ctx.fillStyle = color;
  ctx.fillRect(box[0], box[1], box[2], box[3]);
}
