/** Procedural 48 px/tile HD pixel-art textures for Sanctuary Hub & Safe Room fixtures [REQ-P9-15]. */
import { PropKind } from "@dc2d/contracts";
import type { Texture } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas, fillEllipsePixel, stampSelOutOutline } from "../pixelCanvas.js";

export interface SafeRoomPropTextures {
  readonly stashChest: Texture;
  readonly bountyBoard: Texture;
  readonly npcGuide: Texture;
  readonly npcMerchant: Texture;
  readonly npcBlacksmith: Texture;
}

export const SAFE_ROOM_PROP_KINDS: readonly PropKind[] = [
  PropKind.StashChest,
  PropKind.BountyBoard,
  PropKind.NpcGuide,
  PropKind.NpcMerchant,
  PropKind.NpcBlacksmith,
];

function paintBoxSprite(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): Texture {
  const { canvas, ctx } = createPixelCanvas(w, h);
  paint(ctx);
  stampSelOutOutline(ctx, { w, h });
  return canvasToNearestTexture(canvas);
}

function makeStashChest(): Texture {
  return paintBoxSprite(44, 44, (ctx) => {
    ctx.fillStyle = "#5c3a21"; ctx.fillRect(8, 16, 28, 20);
    ctx.fillStyle = "#8a5a36"; ctx.fillRect(10, 12, 24, 10);
    ctx.fillStyle = "#1d4ed8"; ctx.fillRect(10, 21, 24, 4);
    ctx.fillStyle = "#facc15"; ctx.fillRect(19, 20, 6, 8);
    ctx.fillStyle = "#94a3b8"; ctx.fillRect(8, 15, 3, 21); ctx.fillRect(33, 15, 3, 21);
  });
}

function makeBountyBoard(): Texture {
  return paintBoxSprite(48, 54, (ctx) => {
    ctx.fillStyle = "#4a2c18"; ctx.fillRect(10, 18, 4, 30); ctx.fillRect(34, 18, 4, 30);
    ctx.fillStyle = "#6e4425"; ctx.fillRect(6, 10, 36, 24);
    ctx.fillStyle = "#f1e5c8";
    ctx.fillRect(10, 14, 9, 13); ctx.fillRect(21, 13, 8, 14); ctx.fillRect(31, 15, 8, 12);
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(13, 13, 3, 3); ctx.fillRect(24, 12, 3, 3); ctx.fillRect(34, 14, 3, 3);
  });
}

const SKIN_TONE = "#f3cba5";
const FEET_SHADOW = "rgba(0,0,0,0.35)";

function makeNpcGuide(): Texture {
  return paintBoxSprite(48, 56, (ctx) => {
    fillEllipsePixel(ctx, { cx: 24, cy: 48, rx: 12, ry: 4, color: FEET_SHADOW });
    ctx.fillStyle = "#166534"; ctx.fillRect(15, 22, 18, 22);
    ctx.fillStyle = "#22c55e"; ctx.fillRect(17, 13, 14, 11);
    ctx.fillStyle = SKIN_TONE; ctx.fillRect(19, 16, 10, 7);
    ctx.fillStyle = "#78350f"; ctx.fillRect(35, 16, 3, 30);
    ctx.fillStyle = "#38bdf8"; ctx.fillRect(33, 12, 7, 6);
  });
}

function makeNpcMerchant(): Texture {
  return paintBoxSprite(48, 56, (ctx) => {
    fillEllipsePixel(ctx, { cx: 24, cy: 48, rx: 12, ry: 4, color: FEET_SHADOW });
    ctx.fillStyle = "#7f1d1d"; ctx.fillRect(13, 22, 22, 22);
    ctx.fillStyle = "#b91c1c"; ctx.fillRect(16, 12, 16, 12);
    ctx.fillStyle = SKIN_TONE; ctx.fillRect(18, 15, 12, 7);
    ctx.fillStyle = "#facc15"; ctx.fillRect(10, 26, 6, 8); ctx.fillRect(32, 25, 6, 8);
  });
}

function makeNpcBlacksmith(): Texture {
  return paintBoxSprite(50, 56, (ctx) => {
    fillEllipsePixel(ctx, { cx: 24, cy: 48, rx: 13, ry: 4, color: FEET_SHADOW });
    ctx.fillStyle = "#451a03"; ctx.fillRect(13, 22, 20, 22);
    ctx.fillStyle = "#78350f"; ctx.fillRect(16, 24, 14, 18);
    ctx.fillStyle = SKIN_TONE; ctx.fillRect(17, 14, 12, 8);
    ctx.fillStyle = "#334155"; ctx.fillRect(32, 34, 14, 10);
    ctx.fillStyle = "#fb923c"; ctx.fillRect(35, 31, 8, 4);
  });
}

export function createSafeRoomPropTextures(): SafeRoomPropTextures {
  return {
    stashChest: makeStashChest(),
    bountyBoard: makeBountyBoard(),
    npcGuide: makeNpcGuide(),
    npcMerchant: makeNpcMerchant(),
    npcBlacksmith: makeNpcBlacksmith(),
  };
}
