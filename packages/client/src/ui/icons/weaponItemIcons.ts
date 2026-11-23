/** Crisp 32x32 pixel painters for extended weapon roster (Dagger, Spear, Greatsword). */
import { fillCluster } from "../../render/textures/pixelCanvas.js";

function paintFlintDagger(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#7c3f1d"; ctx.fillRect(6, 22, 4, 4);
  ctx.fillStyle = "#e2e8f0"; ctx.fillRect(9, 19, 3, 3);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#475569" : "#64748b";
    ctx.fillRect(11 + i, 18 - i, 3, 3);
  }
  ctx.fillStyle = "#cbd5e1"; ctx.fillRect(19, 9, 3, 3);
  ctx.fillStyle = "#f8fafc"; ctx.fillRect(21, 8, 2, 2);
}

function paintWoodenSpear(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = "#9c6234"; ctx.fillRect(5 + i, 24 - i, 2, 2);
  }
  ctx.fillStyle = "#e2e8f0"; ctx.fillRect(19, 10, 3, 3);
  fillCluster(ctx, [
    { cx: 23, cy: 8, rx: 3, ry: 2, color: "#94a3b8" },
    { cx: 25, cy: 6, rx: 2, ry: 2, color: "#e2e8f0" },
  ]);
}

function paintIronGreatsword(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#d97706"; ctx.fillRect(3, 25, 3, 3);
  ctx.fillStyle = "#6b3f1d"; ctx.fillRect(5, 21, 5, 5);
  ctx.fillStyle = "#475569"; ctx.fillRect(7, 15, 10, 2); ctx.fillRect(12, 13, 2, 9);
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#cbd5e1" : "#94a3b8";
    ctx.fillRect(11 + i, 16 - i, 4, 4);
  }
  ctx.fillStyle = "#f8fafc"; ctx.fillRect(25, 4, 3, 3);
}

export const WEAPON_ITEM_PAINTERS: Readonly<Record<string, (ctx: CanvasRenderingContext2D, id: string) => void>> = {
  "flint-dagger": paintFlintDagger,
  "wooden-spear": paintWoodenSpear,
  "iron-greatsword": paintIronGreatsword,
};
