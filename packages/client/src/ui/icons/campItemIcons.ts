/** 32x32 pixel-art item icon painters for Phase 8 ores, berries/salves, and camp building kits. */
import { fillCluster, fillEllipsePixel } from "../../render/textures/pixelCanvas.js";

function paintOre(ctx: CanvasRenderingContext2D, main: string, vein: string): void {
  fillCluster(ctx, [
    { cx: 16, cy: 17, rx: 8, ry: 6, color: "#475569" },
    { cx: 15, cy: 15, rx: 6, ry: 4, color: "#64748b" },
  ]);
  ctx.fillStyle = main; ctx.fillRect(11, 14, 4, 4); ctx.fillRect(17, 16, 4, 3);
  ctx.fillStyle = vein; ctx.fillRect(12, 13, 2, 2); ctx.fillRect(18, 15, 2, 2);
}

function paintBerry(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#15803d"; ctx.fillRect(14, 9, 4, 4);
  fillCluster(ctx, [
    { cx: 13, cy: 17, rx: 4, ry: 4, color: "#dc2626" },
    { cx: 19, cy: 17, rx: 4, ry: 4, color: "#b91c1c" },
    { cx: 16, cy: 20, rx: 4, ry: 4, color: "#ef4444" },
  ]);
}

function paintTea(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#92400e"; ctx.fillRect(11, 13, 10, 11);
  ctx.fillStyle = "#4ade80"; ctx.fillRect(12, 12, 8, 3);
  ctx.fillStyle = "#d97706"; ctx.fillRect(21, 15, 3, 6);
  ctx.fillStyle = "#e2e8f0"; ctx.fillRect(14, 8, 1, 3); ctx.fillRect(17, 7, 1, 4);
}

function paintSalve(ctx: CanvasRenderingContext2D): void {
  fillEllipsePixel(ctx, { cx: 16, cy: 18, rx: 7, ry: 6, color: "#b45309" });
  ctx.fillStyle = "#4ade80"; ctx.fillRect(12, 12, 8, 5);
  ctx.fillStyle = "#bbf7d0"; ctx.fillRect(13, 13, 4, 2);
}

function paintCampfireKit(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#78350f"; ctx.fillRect(8, 21, 16, 4);
  fillCluster(ctx, [
    { cx: 16, cy: 15, rx: 6, ry: 6, color: "#ea580c" },
    { cx: 16, cy: 15, rx: 3, ry: 4, color: "#facc15" },
  ]);
}

function paintStandingTorchKit(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#6b3e1e"; ctx.fillRect(14, 12, 4, 14);
  ctx.fillStyle = "#f97316"; ctx.fillRect(12, 7, 8, 6);
  ctx.fillStyle = "#fde047"; ctx.fillRect(14, 8, 4, 4);
}

function paintStorageChest(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#78350f"; ctx.fillRect(8, 12, 16, 13);
  ctx.fillStyle = "#b45309"; ctx.fillRect(9, 10, 14, 4);
  ctx.fillStyle = "#facc15"; ctx.fillRect(15, 14, 2, 4);
}

function paintWorkbenchKit(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#7c4724"; ctx.fillRect(8, 14, 16, 5);
  ctx.fillStyle = "#4b2c15"; ctx.fillRect(10, 19, 3, 6); ctx.fillRect(19, 19, 3, 6);
  ctx.fillStyle = "#cbd5e1"; ctx.fillRect(18, 11, 4, 3);
}

function paintBedKit(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#7c4724"; ctx.fillRect(7, 13, 18, 10);
  ctx.fillStyle = "#f1f5f9"; ctx.fillRect(9, 14, 4, 6);
  ctx.fillStyle = "#dc2626"; ctx.fillRect(13, 14, 11, 7);
}

function paintPalisadeKit(ctx: CanvasRenderingContext2D): void {
  for (const sx of [9, 15, 21]) {
    ctx.fillStyle = "#784928"; ctx.fillRect(sx, 8, 4, 16);
    ctx.fillStyle = "#a16207"; ctx.fillRect(sx + 1, 7, 2, 2);
  }
  ctx.fillStyle = "#4b2c15"; ctx.fillRect(8, 15, 16, 3);
}

export const CAMP_ITEM_PAINTERS: Readonly<Record<string, (ctx: CanvasRenderingContext2D) => void>> = {
  "copper-ore": (ctx) => paintOre(ctx, "#c2591b", "#f59e0b"),
  "iron-ore": (ctx) => paintOre(ctx, "#94a3b8", "#e2e8f0"),
  berry: paintBerry,
  "herb-tea": paintTea,
  "healing-salve": paintSalve,
  "camp-campfire": paintCampfireKit,
  "standing-torch": paintStandingTorchKit,
  "storage-chest": paintStorageChest,
  workbench: paintWorkbenchKit,
  "camp-bed": paintBedKit,
  "wood-palisade": paintPalisadeKit,
};
