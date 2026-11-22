/** 16x16 HD-pixel rect specs for all catalog items (kept within 1..14 for 1px outline). */
import type { PixelRect } from "../../render/textures/pixelCanvas.js";

const WOOD_DK = "#78350f";
const WOOD_LT = "#b45309";
const TAN_LT = "#f5d0a9";
const STEEL_LT = "#e2e8f0";
const STEEL_MD = "#94a3b8";
const STEEL_DK = "#64748b";
const GOLD = "#f59e0b";
const GOLD_LT = "#fde047";
const LTH_DK = "#7c2d12";
const LTH_MD = "#9a3412";
const LTH_LT = "#c2410c";
const FLINT_DK = "#334155";
const FLINT_LT = "#64748b";
const HERB_DK = "#15803d";
const HERB_LT = "#4ade80";
const LINEN_LT = "#f8fafc";
const LINEN_MD = "#cbd5e1";
const DARK_SLATE = "#1e293b";

export const ITEM_ICON_SPECS: Readonly<Record<string, readonly PixelRect[]>> = {
  sword: [
    [11, 2, 2, 2, STEEL_LT], [9, 3, 3, 2, STEEL_LT], [8, 4, 3, 2, STEEL_MD],
    [6, 6, 3, 3, STEEL_LT], [5, 8, 2, 2, GOLD], [4, 7, 5, 2, GOLD_LT],
    [3, 10, 2, 3, WOOD_DK], [2, 12, 2, 2, GOLD],
  ],
  bow: [
    [5, 2, 4, 2, WOOD_LT], [4, 4, 2, 2, WOOD_DK], [3, 6, 2, 4, WOOD_LT],
    [4, 10, 2, 2, WOOD_DK], [5, 12, 4, 2, WOOD_LT], [9, 3, 1, 10, TAN_LT],
  ],
  axe: [
    [7, 4, 2, 10, WOOD_LT], [6, 12, 2, 2, WOOD_DK], [8, 3, 5, 4, STEEL_MD],
    [10, 4, 3, 3, STEEL_LT], [8, 7, 3, 2, STEEL_DK],
  ],
  pickaxe: [
    [7, 5, 2, 9, WOOD_LT], [3, 3, 10, 2, STEEL_MD], [5, 2, 6, 2, STEEL_LT],
    [2, 5, 2, 2, STEEL_DK], [12, 5, 2, 2, STEEL_DK],
  ],
  "wooden-shield": [
    [4, 2, 8, 12, STEEL_MD], [2, 4, 12, 8, STEEL_MD],
    [5, 3, 6, 10, WOOD_LT], [3, 5, 10, 6, WOOD_LT],
    [6, 5, 4, 6, WOOD_DK], [7, 7, 2, 2, STEEL_LT],
  ],
  "leather-hood": [
    [6, 1, 4, 2, LTH_LT], [4, 3, 8, 3, LTH_LT], [3, 5, 10, 5, LTH_MD],
    [5, 5, 6, 5, DARK_SLATE], [6, 6, 4, 3, "#0f172a"],
    [2, 10, 12, 3, LTH_MD], [3, 12, 10, 2, LTH_DK], [7, 10, 2, 2, GOLD],
  ],
  "leather-tunic": [
    [3, 3, 10, 3, LTH_LT], [5, 5, 6, 8, LTH_MD], [2, 4, 3, 4, LTH_DK],
    [11, 4, 3, 4, LTH_DK], [5, 9, 6, 2, GOLD],
  ],
  "leather-leggings": [
    [3, 2, 10, 2, DARK_SLATE], [7, 2, 2, 2, GOLD], [4, 4, 8, 2, LTH_LT],
    [4, 6, 3, 8, LTH_MD], [9, 6, 3, 8, LTH_MD],
    [4, 9, 3, 2, LTH_DK], [9, 9, 3, 2, LTH_DK],
  ],
  "leather-boots": [
    [3, 4, 4, 8, LTH_MD], [9, 4, 4, 8, LTH_MD], [2, 10, 5, 3, LTH_DK],
    [9, 10, 5, 3, LTH_DK], [3, 5, 4, 2, LTH_LT], [9, 5, 4, 2, LTH_LT],
  ],
  torch: [
    [7, 7, 2, 7, WOOD_DK], [6, 6, 4, 2, FLINT_DK], [6, 3, 4, 3, "#f97316"],
    [7, 2, 2, 3, GOLD_LT],
  ],
  bandage: [
    [3, 4, 10, 8, LINEN_LT], [4, 6, 8, 4, LINEN_MD], [7, 5, 2, 6, "#ef4444"],
    [5, 7, 6, 2, "#ef4444"],
  ],
  "cooked-meat": [
    [3, 5, 8, 6, "#9a3412"], [4, 6, 6, 4, "#c2410c"], [5, 7, 4, 2, WOOD_DK],
    [11, 7, 3, 2, LINEN_LT],
  ],
  "raw-meat": [
    [3, 5, 8, 6, "#dc2626"], [4, 6, 5, 4, "#f87171"], [6, 7, 2, 2, "#fecaca"],
    [11, 7, 3, 2, LINEN_LT],
  ],
  arrow: [
    [3, 11, 2, 2, LINEN_LT], [5, 9, 2, 2, WOOD_LT], [7, 7, 2, 2, WOOD_LT],
    [9, 5, 2, 2, WOOD_LT], [10, 3, 3, 3, STEEL_LT], [11, 2, 2, 2, STEEL_MD],
  ],
  wood: [
    [2, 5, 10, 4, WOOD_LT], [3, 6, 8, 2, WOOD_DK], [11, 5, 3, 4, TAN_LT],
    [4, 9, 9, 4, WOOD_DK], [12, 9, 2, 4, TAN_LT],
  ],
  stone: [
    [4, 4, 8, 8, STEEL_DK], [3, 6, 10, 5, STEEL_MD], [5, 5, 5, 3, STEEL_LT],
  ],
  flint: [
    [6, 3, 4, 3, FLINT_LT], [4, 6, 8, 5, FLINT_DK], [5, 10, 6, 3, DARK_SLATE],
    [7, 5, 2, 4, STEEL_MD],
  ],
  herb: [
    [7, 7, 2, 6, HERB_DK], [4, 5, 4, 4, HERB_LT], [8, 4, 4, 4, HERB_LT],
    [6, 2, 4, 4, "#86efac"],
  ],
};
