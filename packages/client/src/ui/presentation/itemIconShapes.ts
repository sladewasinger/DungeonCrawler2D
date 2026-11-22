/** Pixel-art rect specifications ([x, y, w, h, color]) on a 16x16 grid for every item. */
export type PixelRect = readonly [number, number, number, number, string];

const WEAPON_SHAPES: Readonly<Record<string, readonly PixelRect[]>> = {
  sword: [
    [11, 2, 3, 3, "#d8e2ec"], [9, 4, 3, 3, "#b8c7d6"], [7, 6, 3, 3, "#9fb2c4"],
    [5, 8, 3, 3, "#8a6240"], [4, 7, 2, 2, "#c89b3c"], [7, 10, 2, 2, "#c89b3c"],
    [3, 10, 3, 3, "#6b4423"], [2, 12, 2, 2, "#d4af37"],
  ],
  knife: [
    [10, 3, 3, 3, "#e2e8f0"], [8, 5, 3, 3, "#cbd5e1"], [6, 7, 2, 2, "#94a3b8"],
    [5, 8, 3, 2, "#78350f"], [3, 10, 3, 3, "#451a03"],
  ],
  hammer: [
    [8, 2, 6, 4, "#64748b"], [9, 3, 4, 2, "#94a3b8"], [7, 3, 2, 3, "#475569"],
    [6, 6, 3, 3, "#78350f"], [4, 8, 3, 3, "#78350f"], [2, 10, 3, 3, "#451a03"],
  ],
  bow: [
    [5, 2, 4, 2, "#8b5a2b"], [3, 4, 2, 3, "#a06b35"], [2, 7, 2, 3, "#8b5a2b"],
    [3, 10, 2, 2, "#a06b35"], [5, 12, 4, 2, "#8b5a2b"],
    [8, 3, 1, 10, "#e2e8f0"], [4, 7, 8, 2, "#c28e5c"], [11, 6, 3, 4, "#94a3b8"],
  ],
  arrow: [
    [11, 2, 3, 3, "#cbd5e1"], [9, 4, 2, 2, "#64748b"], [5, 6, 5, 2, "#a16207"],
    [4, 8, 3, 2, "#a16207"], [2, 10, 3, 2, "#fef2f2"], [3, 12, 2, 2, "#ef4444"],
  ],
};

const USABLE_SHAPES: Readonly<Record<string, readonly PixelRect[]>> = {
  bandage: [
    [3, 4, 10, 8, "#f8fafc"], [4, 3, 8, 10, "#e2e8f0"],
    [7, 5, 2, 6, "#dc2626"], [5, 7, 6, 2, "#dc2626"],
  ],
  torch: [
    [6, 2, 4, 3, "#fef08a"], [5, 3, 6, 3, "#f97316"], [6, 5, 4, 2, "#dc2626"],
    [6, 7, 4, 2, "#78350f"], [7, 9, 2, 5, "#854d0e"],
  ],
  "water-flask": [
    [6, 2, 4, 2, "#a16207"], [7, 4, 2, 2, "#bae6fd"],
    [4, 6, 8, 7, "#0284c7"], [5, 7, 6, 5, "#38bdf8"], [6, 8, 2, 2, "#e0f2fe"],
  ],
  "vodka-bottle": [
    [7, 2, 2, 3, "#dc2626"], [6, 5, 4, 2, "#a3e635"],
    [5, 7, 6, 7, "#3f6212"], [6, 8, 4, 5, "#65a30d"], [6, 9, 3, 2, "#fef08a"],
  ],
  "raw-meat": [
    [3, 5, 9, 7, "#dc2626"], [4, 4, 7, 7, "#ef4444"],
    [5, 6, 4, 3, "#fca5a5"], [11, 8, 3, 3, "#f8fafc"],
  ],
  "cooked-meat": [
    [3, 5, 9, 7, "#7c2d12"], [4, 4, 7, 7, "#9a3412"],
    [5, 6, 4, 3, "#c2410c"], [11, 8, 3, 3, "#fef3c7"],
  ],
  herb: [
    [7, 4, 2, 9, "#15803d"], [4, 5, 4, 3, "#22c55e"],
    [8, 6, 4, 3, "#4ade80"], [4, 9, 4, 2, "#16a34a"],
  ],
};

const MATERIAL_SHAPES: Readonly<Record<string, readonly PixelRect[]>> = {
  rag: [
    [3, 4, 9, 8, "#d6d3d1"], [5, 3, 7, 7, "#e7e5e4"], [4, 8, 6, 3, "#a8a29e"],
  ],
  stick: [
    [10, 3, 3, 2, "#a16207"], [7, 5, 4, 3, "#854d0e"],
    [5, 8, 3, 3, "#713f12"], [3, 10, 3, 3, "#713f12"],
  ],
  flint: [
    [5, 3, 6, 9, "#475569"], [4, 5, 8, 6, "#334155"],
    [6, 4, 4, 4, "#94a3b8"], [8, 7, 3, 3, "#1e293b"],
  ],
  "spider-silk": [
    [3, 7, 10, 2, "#f1f5f9"], [7, 3, 2, 10, "#f1f5f9"],
    [4, 4, 8, 8, "#e2e8f0"], [6, 6, 4, 4, "#ffffff"],
  ],
  "wolf-pelt": [
    [3, 3, 10, 10, "#64748b"], [4, 4, 8, 8, "#94a3b8"],
    [5, 5, 6, 5, "#475569"], [2, 5, 2, 4, "#475569"], [12, 5, 2, 4, "#475569"],
  ],
  "bear-hide": [
    [2, 3, 12, 10, "#451a03"], [3, 4, 10, 8, "#78350f"],
    [5, 5, 6, 6, "#92400e"], [4, 2, 3, 2, "#451a03"], [9, 2, 3, 2, "#451a03"],
  ],
};

function armorRects(slot: string, primary: string, trim: string): readonly PixelRect[] {
  if (slot === "head") {
    return [[4, 3, 8, 8, primary], [3, 5, 10, 6, primary], [5, 7, 6, 4, "#1e293b"], [4, 4, 8, 2, trim]];
  }
  if (slot === "chest") {
    return [[2, 3, 12, 5, primary], [4, 4, 8, 9, primary], [5, 5, 6, 7, trim], [6, 3, 4, 2, "#1e293b"]];
  }
  if (slot === "legs") {
    return [[4, 3, 8, 4, trim], [4, 7, 3, 6, primary], [9, 7, 3, 6, primary]];
  }
  return [[3, 6, 4, 7, primary], [9, 6, 4, 7, primary], [2, 11, 5, 2, trim], [9, 11, 5, 2, trim]];
}

export const ITEM_ICON_SHAPES: Readonly<Record<string, readonly PixelRect[]>> = {
  ...WEAPON_SHAPES,
  ...USABLE_SHAPES,
  ...MATERIAL_SHAPES,
  "leather-hood": armorRects("head", "#8b5a2b", "#c28e5c"),
  "leather-tunic": armorRects("chest", "#8b5a2b", "#c28e5c"),
  "leather-leggings": armorRects("legs", "#8b5a2b", "#c28e5c"),
  "leather-boots": armorRects("boots", "#8b5a2b", "#c28e5c"),
  "grizzly-helm": armorRects("head", "#5c3317", "#94a3b8"),
  "grizzly-cuirass": armorRects("chest", "#5c3317", "#94a3b8"),
  "grizzly-greaves": armorRects("legs", "#5c3317", "#94a3b8"),
  "grizzly-boots": armorRects("boots", "#5c3317", "#94a3b8"),
};

export const ARMOR_SLOT_SILHOUETTES: Readonly<Record<string, readonly PixelRect[]>> = {
  head: armorRects("head", "#334155", "#475569"),
  chest: armorRects("chest", "#334155", "#475569"),
  legs: armorRects("legs", "#334155", "#475569"),
  boots: armorRects("boots", "#334155", "#475569"),
};
