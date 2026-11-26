/** Crisp outlined held textures & shield variants for all Frontier weapons, bows, tools, and shields. */
import type { ItemWeaponArchetype } from "@dc2d/contracts";
import { Texture } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas, drawRects, stampDarkOutline, type PixelRect } from "../../textures/pixelCanvas.js";
import { OUTLINE_RGB } from "../characterTypes.js";

export type HeldArchetype = Exclude<ItemWeaponArchetype, "torch">;

interface WeaponPalette {
  readonly archetype: HeldArchetype;
  readonly shaft: string;
  readonly guard: string;
  readonly blade: string;
  readonly edge: string;
}

const PALETTES: Readonly<Record<string, WeaponPalette>> = {
  "copper-pickaxe": { archetype: "pickaxe", shaft: "#7c4722", guard: "#b45309", blade: "#d97706", edge: "#fcd34d" },
  "copper-axe": { archetype: "axe", shaft: "#7c4722", guard: "#b45309", blade: "#d97706", edge: "#fde68a" },
  "copper-sword": { archetype: "sword", shaft: "#6b3f1d", guard: "#f59e0b", blade: "#d97706", edge: "#fde68a" },
  "copper-spear": { archetype: "spear", shaft: "#9c6234", guard: "#f59e0b", blade: "#d97706", edge: "#fde68a" },
  "bandit-cutlass": { archetype: "sword", shaft: "#451a03", guard: "#fbbf24", blade: "#94a3b8", edge: "#f8fafc" },
  "bog-dagger": { archetype: "dagger", shaft: "#292524", guard: "#4d7c0f", blade: "#3f6212", edge: "#84cc16" },
  "amber-recurve-bow": { archetype: "bow", shaft: "#9a3412", guard: "#f59e0b", blade: "#d97706", edge: "#fef08a" },
  "frost-hatchet": { archetype: "axe", shaft: "#475569", guard: "#94a3b8", blade: "#38bdf8", edge: "#e0f2fe" },
  "golem-maul": { archetype: "greatsword", shaft: "#475569", guard: "#f59e0b", blade: "#64748b", edge: "#38bdf8" },
  "shadowfang-spear": { archetype: "spear", shaft: "#312e81", guard: "#a855f7", blade: "#4c1d95", edge: "#d8b4fe" },
  "venom-fang-blade": { archetype: "sword", shaft: "#1e293b", guard: "#15803d", blade: "#16a34a", edge: "#86efac" },
  "sunforged-greatsword": { archetype: "greatsword", shaft: "#78350f", guard: "#f59e0b", blade: "#fbbf24", edge: "#fef9c3" },
  "bloodmoon-scythe": { archetype: "greatsword", shaft: "#3b0764", guard: "#dc2626", blade: "#991b1b", edge: "#fca5a5" },
  "whisperwind-bow": { archetype: "bow", shaft: "#134e4a", guard: "#2dd4bf", blade: "#0f766e", edge: "#ccfbf1" },
};

const texCache = new Map<string, Texture>();

function bakeRects(key: string, size: { readonly w: number; readonly h: number }, rects: readonly PixelRect[]): Texture {
  const cached = texCache.get(key);
  if (cached) return cached;
  if (typeof document === "undefined") return Texture.EMPTY;
  const { canvas, ctx } = createPixelCanvas(size.w, size.h);
  drawRects(ctx, rects);
  stampDarkOutline(ctx, size, OUTLINE_RGB);
  const tex = canvasToNearestTexture(canvas);
  texCache.set(key, tex);
  return tex;
}

interface BakedShape { readonly w: number; readonly h: number; readonly rects: PixelRect[] }

function greatswordRects(p: WeaponPalette, id: string): BakedShape {
  if (id === "golem-maul") {
    return { w: 34, h: 16, rects: [[2, 7, 20, 2, p.shaft], [22, 2, 10, 12, p.blade], [24, 4, 6, 8, p.guard], [26, 6, 3, 4, p.edge]] };
  }
  if (id === "bloodmoon-scythe") {
    return { w: 36, h: 16, rects: [[2, 8, 24, 2, p.shaft], [24, 2, 4, 12, p.blade], [27, 2, 6, 5, p.blade], [30, 3, 4, 4, p.edge], [22, 7, 4, 4, p.guard]] };
  }
  return { w: 36, h: 14, rects: [[2, 6, 2, 2, p.guard], [4, 6, 6, 2, p.shaft], [10, 2, 2, 10, p.guard], [12, 4, 20, 6, p.blade], [12, 4, 21, 2, p.edge], [32, 5, 3, 4, p.edge]] };
}

const SHAPE_BUILDERS: Readonly<Record<HeldArchetype, (p: WeaponPalette, id: string) => BakedShape>> = {
  bow: (p) => ({
    w: 16, h: 26,
    rects: [
      [3, 4, 1, 18, "#e2e8f0"], [3, 2, 3, 3, p.shaft], [5, 4, 3, 4, p.blade], [7, 8, 2, 3, p.blade],
      [7, 11, 2, 4, p.guard], [7, 15, 2, 3, p.blade], [5, 18, 3, 4, p.blade], [3, 21, 3, 3, p.shaft],
      [3, 12, 9, 2, "#b47b48"], [2, 11, 2, 4, "#f1f5f9"], [12, 11, 2, 4, p.edge], [14, 12, 2, 2, p.edge],
    ],
  }),
  dagger: (p) => ({ w: 18, h: 10, rects: [[2, 4, 4, 2, p.shaft], [6, 3, 2, 4, p.guard], [8, 3, 7, 4, p.blade], [14, 4, 3, 2, p.edge]] }),
  spear: (p) => ({ w: 34, h: 10, rects: [[2, 4, 24, 2, p.shaft], [23, 3, 3, 4, p.guard], [26, 3, 6, 4, p.blade], [31, 4, 2, 2, p.edge]] }),
  axe: (p) => ({ w: 24, h: 14, rects: [[2, 5, 17, 2, p.shaft], [16, 4, 3, 4, p.guard], [14, 7, 7, 4, p.blade], [18, 6, 4, 6, p.edge]] }),
  pickaxe: (p) => ({ w: 24, h: 16, rects: [[2, 7, 16, 2, p.shaft], [16, 6, 3, 4, p.guard], [15, 2, 4, 12, p.blade], [17, 2, 4, 4, p.blade], [17, 10, 4, 4, p.blade], [20, 2, 2, 2, p.edge], [20, 12, 2, 2, p.edge]] }),
  greatsword: greatswordRects,
  sword: (p) => ({ w: 26, h: 12, rects: [[2, 5, 2, 2, p.guard], [4, 5, 4, 2, p.shaft], [8, 2, 2, 8, p.guard], [10, 4, 13, 4, p.blade], [10, 4, 14, 2, p.edge], [23, 5, 2, 2, p.edge]] }),
};

export function getTierWeaponMeta(itemId: string): { readonly archetype: HeldArchetype; readonly tex: Texture } | null {
  const pal = PALETTES[itemId];
  if (!pal) return null;
  const spec = SHAPE_BUILDERS[pal.archetype](pal, itemId);
  return { archetype: pal.archetype, tex: bakeRects(`w:${itemId}`, { w: spec.w, h: spec.h }, spec.rects) };
}

const SHIELD_SPECS: Readonly<Record<string, { readonly rim: string; readonly face: string; readonly boss: string }>> = {
  "reinforced-shield": { rim: "#d97706", face: "#64748b", boss: "#fde68a" },
  "runic-buckler": { rim: "#38bdf8", face: "#334155", boss: "#e0f2fe" },
  "aegis-tower-shield": { rim: "#fbbf24", face: "#475569", boss: "#fef08a" },
};

export const TIER_HELD_GEAR_IDS: readonly string[] = [
  ...Object.keys(PALETTES),
  ...Object.keys(SHIELD_SPECS),
];

export function getTierShieldTexture(offhandId: string | null | undefined): Texture | null {
  if (!offhandId) return null;
  const s = SHIELD_SPECS[offhandId];
  if (!s) return null;
  const tall = offhandId === "aegis-tower-shield";
  const rects: PixelRect[] = tall
    ? [[1, 0, 8, 1, s.rim], [0, 1, 10, 10, s.rim], [1, 2, 8, 8, s.face], [2, 11, 6, 1, s.rim], [4, 4, 2, 4, s.boss]]
    : [[2, 0, 6, 1, s.rim], [1, 1, 8, 9, s.rim], [2, 2, 6, 7, s.face], [3, 10, 4, 1, s.rim], [4, 4, 2, 2, s.boss]];
  return bakeRects(`sh:${offhandId}`, { w: 10, h: 12 }, rects);
}