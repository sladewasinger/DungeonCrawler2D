/** Crisp 32x32 outlined pixel-art item icons for HUD slots, crafting cards, and held fallbacks. */
import { Texture } from "pixi.js";
import {
  canvasToNearestTexture, createPixelCanvas, fillCluster, fillEllipsePixel, stampSelOutOutline,
} from "../../render/textures/pixelCanvas.js";
import { CAMP_ITEM_PAINTERS } from "./campItemIcons.js";
import { FRONTIER_ITEM_PAINTERS } from "./frontierItemIcons.js";
import { WEAPON_ITEM_PAINTERS } from "./weaponItemIcons.js";

const iconUrlCache = new Map<string, string>();
const heldTextureCache = new Map<string, Texture>();

function paintSword(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < 15; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#e2e8f0" : "#cbd5e1";
    ctx.fillRect(21 - i, 6 + i, 3, 3);
  }
  ctx.fillStyle = "#f59e0b"; ctx.fillRect(7, 17, 7, 2); ctx.fillRect(10, 14, 2, 7);
  ctx.fillStyle = "#7c3f1d"; ctx.fillRect(5, 22, 4, 4);
  ctx.fillStyle = "#d97706"; ctx.fillRect(4, 24, 3, 3);
}

function paintBow(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#e2e8f0"; ctx.fillRect(10, 6, 1, 20);
  const arc = [[10, 6], [13, 6], [16, 8], [18, 11], [19, 15], [18, 19], [16, 22], [13, 24], [10, 24]];
  for (const [x, y] of arc) {
    ctx.fillStyle = "#9a5b25"; ctx.fillRect(x!, y!, 3, 2);
  }
  ctx.fillStyle = "#c07a3e"; ctx.fillRect(18, 13, 2, 6);
  ctx.fillStyle = "#cbd5e1"; ctx.fillRect(8, 15, 16, 2);
  ctx.fillStyle = "#94a3b8"; ctx.fillRect(22, 14, 4, 4);
}

function paintAxe(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = "#854d27"; ctx.fillRect(8 + i, 23 - i, 3, 3);
  }
  fillCluster(ctx, [
    { cx: 19, cy: 11, rx: 5, ry: 5, color: "#64748b" },
    { cx: 22, cy: 10, rx: 3, ry: 5, color: "#cbd5e1" },
  ]);
  ctx.fillStyle = "#e2e8f0"; ctx.fillRect(23, 6, 2, 8);
}

function paintPickaxe(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = "#854d27"; ctx.fillRect(7 + i, 23 - i, 3, 3);
  }
  ctx.fillStyle = "#64748b";
  ctx.fillRect(12, 6, 11, 3); ctx.fillRect(10, 8, 4, 4); ctx.fillRect(21, 8, 4, 5);
  ctx.fillStyle = "#cbd5e1"; ctx.fillRect(13, 6, 8, 2);
}

function paintTorch(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#6b3e1e"; ctx.fillRect(14, 15, 4, 12);
  ctx.fillStyle = "#334155"; ctx.fillRect(13, 13, 6, 3);
  fillCluster(ctx, [
    { cx: 16, cy: 10, rx: 5, ry: 5, color: "#ea580c" },
    { cx: 16, cy: 10, rx: 3, ry: 4, color: "#fbbf24" },
  ]);
  ctx.fillStyle = "#fef9c3"; ctx.fillRect(15, 9, 2, 2);
}

function paintMap(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#c9a66b"; ctx.fillRect(6, 7, 20, 18);
  ctx.fillStyle = "#edd7ad"; ctx.fillRect(8, 9, 16, 14);
  ctx.fillStyle = "#60a5fa"; ctx.fillRect(10, 14, 12, 3);
  ctx.fillStyle = "#4d7c3f"; ctx.fillRect(10, 10, 6, 3); ctx.fillRect(17, 18, 5, 4);
  ctx.fillStyle = "#dc2626"; ctx.fillRect(19, 10, 2, 2); ctx.fillRect(18, 11, 4, 1);
}

function paintShield(ctx: CanvasRenderingContext2D): void {
  fillCluster(ctx, [
    { cx: 16, cy: 15, rx: 8, ry: 9, color: "#64748b" },
    { cx: 16, cy: 15, rx: 6, ry: 7, color: "#9a5d32" },
    { cx: 16, cy: 15, rx: 2, ry: 2, color: "#fbbf24" },
  ]);
}

function paintLeatherArmor(ctx: CanvasRenderingContext2D, itemId: string): void {
  if (itemId === "leather-hood") {
    fillCluster(ctx, [{ cx: 16, cy: 15, rx: 8, ry: 9, color: "#854d27" }, { cx: 16, cy: 17, rx: 4, ry: 5, color: "#2b1b12" }]);
    return;
  }
  if (itemId === "leather-leggings") {
    ctx.fillStyle = "#7c4724"; ctx.fillRect(9, 7, 14, 7); ctx.fillRect(9, 14, 6, 11); ctx.fillRect(17, 14, 6, 11);
    ctx.fillStyle = "#4b2c15"; ctx.fillRect(9, 7, 14, 3); return;
  }
  if (itemId === "leather-boots") {
    ctx.fillStyle = "#6e3e1e"; ctx.fillRect(8, 10, 6, 14); ctx.fillRect(17, 10, 6, 14);
    ctx.fillStyle = "#4b2c15"; ctx.fillRect(8, 20, 8, 4); ctx.fillRect(17, 20, 8, 4); return;
  }
  ctx.fillStyle = "#854d27"; ctx.fillRect(8, 7, 16, 17);
  ctx.fillStyle = "#a66637"; ctx.fillRect(10, 8, 12, 7);
  ctx.fillStyle = "#3f2414"; ctx.fillRect(8, 17, 16, 3);
  ctx.fillStyle = "#f59e0b"; ctx.fillRect(14, 17, 4, 3);
}

function paintMeat(ctx: CanvasRenderingContext2D, itemId: string): void {
  const cooked = itemId === "cooked-meat";
  fillEllipsePixel(ctx, { cx: 17, cy: 16, rx: 8, ry: 6, color: cooked ? "#8a4224" : "#b91c1c" });
  fillEllipsePixel(ctx, { cx: 15, cy: 15, rx: 5, ry: 3, color: cooked ? "#b86337" : "#ef4444" });
  ctx.fillStyle = "#f8fafc"; ctx.fillRect(7, 15, 5, 3);
}

function paintStoneMat(ctx: CanvasRenderingContext2D, itemId: string): void {
  const flint = itemId === "flint";
  fillCluster(ctx, [
    { cx: 16, cy: 17, rx: 8, ry: 6, color: flint ? "#334155" : "#64748b" },
    { cx: 14, cy: 14, rx: 5, ry: 4, color: flint ? "#475569" : "#94a3b8" },
  ]);
}

function paintBandage(ctx: CanvasRenderingContext2D): void {
  fillEllipsePixel(ctx, { cx: 16, cy: 16, rx: 8, ry: 6, color: "#f1f5f9" });
  ctx.fillStyle = "#dc2626"; ctx.fillRect(15, 12, 2, 8); ctx.fillRect(12, 15, 8, 2);
}

function paintArrowMat(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < 15; i++) { ctx.fillStyle = "#b45309"; ctx.fillRect(7 + i, 22 - i, 2, 2); }
  ctx.fillStyle = "#cbd5e1"; ctx.fillRect(20, 6, 5, 5);
  ctx.fillStyle = "#ef4444"; ctx.fillRect(6, 20, 4, 4);
}

function paintWoodMat(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#78421f"; ctx.fillRect(7, 11, 16, 6); ctx.fillRect(9, 17, 16, 6);
  ctx.fillStyle = "#d99b66"; ctx.fillRect(21, 12, 3, 4); ctx.fillRect(23, 18, 3, 4);
}

function paintHerbMat(ctx: CanvasRenderingContext2D): void {
  fillCluster(ctx, [
    { cx: 12, cy: 15, rx: 4, ry: 4, color: "#15803d" },
    { cx: 20, cy: 15, rx: 4, ry: 4, color: "#16a34a" },
    { cx: 16, cy: 11, rx: 4, ry: 5, color: "#4ade80" },
  ]);
  ctx.fillStyle = "#14532d"; ctx.fillRect(15, 15, 2, 10);
}

function paintFallbackItem(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#f59e0b"; ctx.fillRect(10, 10, 12, 12);
}

const PAINTERS: Readonly<Record<string, (ctx: CanvasRenderingContext2D, id: string) => void>> = {
  sword: paintSword, bow: paintBow, axe: paintAxe, pickaxe: paintPickaxe,
  torch: paintTorch, "wooden-shield": paintShield,
  "leather-hood": paintLeatherArmor, "leather-tunic": paintLeatherArmor,
  "leather-leggings": paintLeatherArmor, "leather-boots": paintLeatherArmor,
  bandage: paintBandage, "raw-meat": paintMeat, "cooked-meat": paintMeat,
  arrow: paintArrowMat, wood: paintWoodMat, stone: paintStoneMat, flint: paintStoneMat, herb: paintHerbMat,
  ...CAMP_ITEM_PAINTERS,
  ...WEAPON_ITEM_PAINTERS,
  ...FRONTIER_ITEM_PAINTERS,
};

function buildItemCanvas(itemId: string): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(32, 32);
  (PAINTERS[itemId] ?? paintFallbackItem)(ctx, itemId);
  stampSelOutOutline(ctx, { w: 32, h: 32, solidPx: 1.4 });
  return canvas;
}

export function makeMapUiIconUrl(): string {
  const cached = iconUrlCache.get("__ui_map__");
  if (cached) return cached;
  const { canvas, ctx } = createPixelCanvas(32, 32);
  paintMap(ctx);
  stampSelOutOutline(ctx, { w: 32, h: 32, solidPx: 1.4 });
  const url = canvas.toDataURL();
  iconUrlCache.set("__ui_map__", url);
  return url;
}

export function getItemIconUrl(itemId: string): string {
  const cached = iconUrlCache.get(itemId);
  if (cached) return cached;
  const url = buildItemCanvas(itemId).toDataURL();
  iconUrlCache.set(itemId, url);
  return url;
}

export function prebakeAllItemIcons(): void {
  if (typeof document === "undefined") return;
  for (const itemId of Object.keys(PAINTERS)) getItemIconUrl(itemId);
}

export function getItemHeldTexture(itemId: string | null | undefined): Texture | null {
  if (!itemId) return null;
  const cached = heldTextureCache.get(itemId);
  if (cached) return cached;
  const tex = canvasToNearestTexture(buildItemCanvas(itemId));
  heldTextureCache.set(itemId, tex);
  return tex;
}
