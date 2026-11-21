import type Phaser from "phaser";

export const SPAWN_HOUSE_TEXTURE_KEY = "forest-spawn-house";

const WIDTH = 112;
const HEIGHT = 80;
const NEAREST_FILTER = 1 as Phaser.Textures.FilterMode;

const C = {
  shadow: "#111612",
  stoneDark: "#242730",
  stoneMid: "#343947",
  stoneLight: "#4d5466",
  stoneTrim: "#61687d",
  roofDark: "#1b1f29",
  roofMid: "#282e3b",
  roofRidge: "#3a4254",
  roofEdge: "#0f1218",
  timberDark: "#211611",
  timberMid: "#3a271c",
  ironDark: "#14161c",
  ironLight: "#555d70",
  emberOuter: "#a63a1e",
  emberCore: "#f08a38",
  emberHot: "#ffd078",
} as const;

export function ensureSpawnHouseTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(SPAWN_HOUSE_TEXTURE_KEY)) return;
  const texture = scene.textures.createCanvas(SPAWN_HOUSE_TEXTURE_KEY, WIDTH, HEIGHT);
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawTowersAndChimney(ctx);
  drawManorWalls(ctx);
  drawGothicRoof(ctx);
  drawBarredWindows(ctx);
  drawIronArchDoor(ctx);
  texture.refresh();
  texture.setFilter(NEAREST_FILTER);
}

function drawTowersAndChimney(ctx: CanvasRenderingContext2D): void {
  rect(ctx, C.stoneDark, [14, 6, 12, 24]);
  rect(ctx, C.stoneLight, [13, 4, 14, 3]);
  rect(ctx, C.stoneDark, [84, 4, 12, 26]);
  rect(ctx, C.stoneLight, [83, 2, 14, 3]);
}

function drawManorWalls(ctx: CanvasRenderingContext2D): void {
  rect(ctx, C.shadow, [3, 74, WIDTH - 6, 6]);
  rect(ctx, C.stoneMid, [5, 40, WIDTH - 10, 36]);
  for (let y = 44; y < 74; y += 5) rect(ctx, C.stoneDark, [5, y, WIDTH - 10, 1]);
  for (const x of [5, 34, 74, WIDTH - 9]) rect(ctx, C.stoneLight, [x, 40, 4, 36]);
  rect(ctx, C.stoneDark, [5, 71, WIDTH - 10, 5]);
  rect(ctx, C.stoneTrim, [5, 70, WIDTH - 10, 1]);
}

function drawGothicRoof(ctx: CanvasRenderingContext2D): void {
  for (let row = 0; row < 34; row++) {
    const inset = Math.max(0, Math.floor((28 - row) * 0.6));
    rect(ctx, roofTone(row), [inset, 8 + row, WIDTH - inset * 2, 1]);
  }
  rect(ctx, C.roofEdge, [0, 40, WIDTH, 4]);
  rect(ctx, C.roofRidge, [2, 39, WIDTH - 4, 1]);
  drawCenterDormer(ctx);
}

function drawCenterDormer(ctx: CanvasRenderingContext2D): void {
  rect(ctx, C.stoneMid, [44, 21, 24, 19]);
  rect(ctx, C.stoneDark, [44, 21, 2, 19]);
  rect(ctx, C.stoneDark, [66, 21, 2, 19]);
  rect(ctx, C.stoneLight, [46, 22, 2, 18]);
  rect(ctx, C.stoneLight, [64, 22, 2, 18]);
  for (let row = 0; row < 12; row++) {
    const left = 54 - row;
    const width = 4 + row * 2;
    rect(ctx, C.roofEdge, [left - 1, 10 + row, width + 2, 1]);
    rect(ctx, C.roofMid, [left + 1, 10 + row, width - 2, 1]);
  }
  rect(ctx, C.roofEdge, [42, 22, 28, 2]);
  rect(ctx, C.roofRidge, [44, 21, 24, 1]);
  rect(ctx, C.stoneTrim, [55, 4, 2, 6]);
}

function roofTone(row: number): string {
  if (row % 6 === 0) return C.roofEdge;
  return row % 2 === 0 ? C.roofMid : C.roofDark;
}

function drawBarredWindows(ctx: CanvasRenderingContext2D): void {
  for (const x of [14, 84]) drawWindow(ctx, x, 48);
  drawWindow(ctx, 49, 24);
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rect(ctx, C.ironDark, [x, y, 14, 14]);
  rect(ctx, C.emberOuter, [x + 2, y + 2, 10, 10]);
  rect(ctx, C.emberCore, [x + 4, y + 4, 6, 7]);
  rect(ctx, C.ironDark, [x + 6, y + 2, 2, 10]);
  rect(ctx, C.ironDark, [x + 2, y + 6, 10, 2]);
  rect(ctx, C.stoneLight, [x - 1, y + 14, 16, 2]);
}

function drawIronArchDoor(ctx: CanvasRenderingContext2D): void {
  rect(ctx, C.stoneDark, [42, 43, 28, 33]);
  rect(ctx, C.stoneTrim, [44, 45, 24, 31]);
  rect(ctx, C.timberDark, [46, 47, 20, 29]);
  rect(ctx, C.timberMid, [48, 49, 7, 27]);
  rect(ctx, C.timberMid, [57, 49, 7, 27]);
  for (const bandY of [53, 62, 70]) rect(ctx, C.ironLight, [46, bandY, 20, 2]);
  rect(ctx, C.ironDark, [53, 59, 6, 6]);
  drawSconce(ctx, 37, 50);
  drawSconce(ctx, 71, 50);
  rect(ctx, C.stoneLight, [40, 76, 32, 4]);
}

function drawSconce(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rect(ctx, C.ironDark, [x, y, 4, 8]);
  rect(ctx, C.emberOuter, [x, y - 3, 4, 4]);
  rect(ctx, C.emberHot, [x + 1, y - 2, 2, 2]);
}

function rect(
  ctx: CanvasRenderingContext2D,
  color: string,
  box: readonly [number, number, number, number],
): void {
  ctx.fillStyle = color;
  ctx.fillRect(box[0], box[1], box[2], box[3]);
}
